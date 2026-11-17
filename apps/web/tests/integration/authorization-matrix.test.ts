import { createHash, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Role x action matrix for the privileged SECURITY DEFINER functions:
 * review_class_assignment, moderate_assignment, accept_class_invitation,
 * decide_class_verification, complete_leave_forwarding, and
 * rsvp_discussion_session.
 *
 * Each function is called by an actor who should succeed and by actors who
 * should be refused, so a policy regression fails here even when the happy path
 * still works. Requires the disposable Supabase project used by the other
 * integration suites; the suite is skipped when SUPABASE_TEST_* is absent.
 */
const url = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const hasEnv = Boolean(url && anonKey && serviceRoleKey);
const suffix = randomUUID().slice(0, 8);
const PASSWORD = `test-${randomUUID()}`;
const TIME_ZONE = "Asia/Jakarta";

type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

type RpcError = { code?: string } | null;

let admin: SupabaseClient;
let anon: SupabaseClient;
let platformAdmin: TestUser;
let classAdmin: TestUser;
let otherClassAdmin: TestUser;
let member: TestUser;
let outsider: TestUser;
let invitee: TestUser;
let verificationStudent: TestUser;
let classA = "";
let classB = "";
let universityId = "";
let subjectIdA = "";
const courseNames: string[] = [];

async function createTestUser(label: string): Promise<TestUser> {
  const email = `starstask-authz-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Authz ${label}` },
  });

  if (error || !data.user) {
    throw new Error(`Could not create test user ${label}: ${error?.message}`);
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });

  if (signInError) {
    throw new Error(`Could not sign in ${label}: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newInviteToken(): string {
  return randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
}

async function createClassAs(
  applicant: TestUser,
  label: string,
): Promise<string> {
  const courseName = `Authz Course ${label} ${suffix}`;
  courseNames.push(courseName);

  const { data: applicationId, error: applyError } = await applicant.client.rpc(
    "apply_for_class",
    {
      p_proposed_slug: `authz-${label}-${suffix}`,
      p_proposed_name: `Authz Class ${label} ${suffix}`,
      p_course_name: courseName,
      p_semester: "1",
      p_academic_year: "2025/2026",
      p_description: "A class used to verify the authorization matrix.",
      p_reason:
        "The applicant maintains the assignment archive for this class.",
    },
  );

  if (applyError || typeof applicationId !== "string") {
    throw new Error(
      `Could not apply for class ${label}: ${applyError?.message}`,
    );
  }

  const { data: classId, error: decideError } = await platformAdmin.client.rpc(
    "decide_class_application",
    {
      p_application_id: applicationId,
      p_decision: "approved",
      p_grant_class_admin: true,
      p_note: "Approved by the authorization matrix suite.",
    },
  );

  if (decideError || typeof classId !== "string") {
    throw new Error(
      `Could not approve class ${label}: ${decideError?.message}`,
    );
  }

  return classId;
}

async function createInvitation(
  inviter: TestUser,
  classId: string,
  options: { emailRestriction?: string; maxUses?: number } = {},
): Promise<{ token: string; invitationId: string }> {
  const token = newInviteToken();
  const { data, error } = await inviter.client.rpc("create_class_invitation", {
    p_class_id: classId,
    p_token_hash: hashToken(token),
    p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    p_max_uses: options.maxUses ?? 1,
    p_email_restriction: options.emailRestriction ?? null,
  });

  if (error || typeof data !== "string") {
    throw new Error(`Could not create invitation: ${error?.message}`);
  }

  return { token, invitationId: data };
}

async function joinClass(
  user: TestUser,
  inviter: TestUser,
  classId: string,
): Promise<void> {
  const { token } = await createInvitation(inviter, classId);
  const { error } = await user.client.rpc("accept_class_invitation", {
    p_token: token,
  });

  if (error) {
    throw new Error(`Could not join class: ${error.message}`);
  }
}

async function createSubject(
  inviter: TestUser,
  classId: string,
  label: string,
): Promise<string> {
  const { data, error } = await inviter.client.rpc("create_class_subject", {
    p_class_id: classId,
    p_name: `Authz Subject ${label} ${suffix}`,
    p_code: null,
    p_description: "Disposable subject used by the authorization matrix.",
    p_lecturer_name: null,
  });

  if (error || typeof data !== "string") {
    throw new Error(`Could not create subject ${label}: ${error?.message}`);
  }

  return data;
}

async function submitAssignment(
  author: TestUser,
  classId: string,
  subjectId: string,
  title: string,
): Promise<string> {
  const { data, error } = await author.client.rpc("submit_class_assignment", {
    p_class_id: classId,
    p_title: title,
    p_description: "A complete submission used to verify authorization.",
    p_assignment_type: "individual",
    p_tags: ["authz"],
    p_subject_id: subjectId,
  });

  if (error || typeof data !== "string") {
    throw new Error(`Could not submit assignment: ${error?.message}`);
  }

  return data;
}

async function createSubmittedLeaveRequest(
  student: TestUser,
  classId: string,
): Promise<string> {
  const { data, error } = await student.client.rpc("create_leave_request", {
    p_class_id: classId,
    p_leave_start_date: "2026-11-02",
    p_leave_end_date: "2026-11-03",
    p_reason_category: "illness",
    p_explanation: "A medical appointment requires an excused absence.",
    p_document_issue_date: "2026-11-01",
  });

  const row = Array.isArray(data) ? data[0] : null;

  if (error || !row || typeof row.id !== "string") {
    throw new Error(`Could not create leave request: ${error?.message}`);
  }

  const { error: evidenceError } = await student.client.rpc(
    "add_leave_request_evidence",
    {
      p_request_id: row.id,
      p_storage_path: `${student.id}/${row.id}/surat.pdf`,
      p_original_filename: "surat.pdf",
      p_mime_type: "application/pdf",
      p_file_size: 1024,
    },
  );

  if (evidenceError) {
    throw new Error(`Could not attach evidence: ${evidenceError.message}`);
  }

  const { error: submitError } = await student.client.rpc(
    "submit_leave_request",
    { p_request_id: row.id },
  );

  if (submitError) {
    throw new Error(`Could not submit leave request: ${submitError.message}`);
  }

  return row.id;
}

function expectDenied(error: RpcError, code = "42501"): void {
  expect(error?.code).toBe(code);
}

describe.skipIf(!hasEnv)("privileged function authorization matrix", () => {
  beforeAll(async () => {
    admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    platformAdmin = await createTestUser("platform");
    classAdmin = await createTestUser("class-admin");
    otherClassAdmin = await createTestUser("other-class-admin");
    member = await createTestUser("member");
    outsider = await createTestUser("outsider");
    invitee = await createTestUser("invitee");
    verificationStudent = await createTestUser("verification");

    // The audit_logs university_id future-rows guard requires university_id on
    // every post-2026-11-05 audit insert; apply_for_class (before any class
    // exists) has no class to resolve a tenant from, so without a membership
    // the audit insert violates the constraint. Seed a disposable tenant.
    const { data: uni, error: uniError } = await admin
      .from("universities")
      .insert({
        slug: `authz-uni-${suffix}`,
        name: `Authz Uni ${suffix}`,
        status: "active",
      })
      .select("id")
      .single();

    if (uniError || !uni) {
      throw new Error(`Could not seed university: ${uniError?.message}`);
    }

    universityId = uni.id as string;

    const { error: memError } = await admin
      .from("university_memberships")
      .insert(
        [
          platformAdmin,
          classAdmin,
          otherClassAdmin,
          member,
          outsider,
          invitee,
          verificationStudent,
        ].map((user) => ({
          user_id: user.id,
          university_id: universityId,
          role: "student",
          status: "active",
        })),
      );

    if (memError) {
      throw new Error(
        `Could not seed university memberships: ${memError.message}`,
      );
    }

    const { error: grantError } = await admin
      .from("platform_admins")
      .insert({ user_id: platformAdmin.id });

    if (grantError) {
      throw new Error(`Could not grant platform admin: ${grantError.message}`);
    }

    classA = await createClassAs(classAdmin, "a");
    classB = await createClassAs(otherClassAdmin, "b");
    subjectIdA = await createSubject(classAdmin, classA, "a");
    await joinClass(member, classAdmin, classA);
  });

  afterAll(async () => {
    if (admin) {
      if (courseNames.length > 0) {
        await admin.from("classes").delete().in("course_name", courseNames);
        await admin.from("courses").delete().in("name", courseNames);
      }

      if (universityId) {
        await admin
          .from("university_memberships")
          .delete()
          .eq("university_id", universityId);
        await admin.from("universities").delete().eq("id", universityId);
      }

      for (const user of [
        platformAdmin,
        classAdmin,
        otherClassAdmin,
        member,
        outsider,
        invitee,
        verificationStudent,
      ]) {
        if (user) {
          await admin.auth.admin.deleteUser(user.id);
        }
      }
    }
  });

  describe("review_class_assignment", () => {
    let publishedAssignmentId = "";

    it("refuses anonymous and unrelated callers", async () => {
      publishedAssignmentId = await submitAssignment(
        member,
        classA,
        subjectIdA,
        "Authorization review target",
      );

      const anonymous = await anon.rpc("review_class_assignment", {
        p_assignment_id: publishedAssignmentId,
        p_decision: "approved",
      });
      expectDenied(anonymous.error);

      const unrelated = await outsider.client.rpc("review_class_assignment", {
        p_assignment_id: publishedAssignmentId,
        p_decision: "approved",
      });
      expectDenied(unrelated.error);

      const wrongClass = await otherClassAdmin.client.rpc(
        "review_class_assignment",
        { p_assignment_id: publishedAssignmentId, p_decision: "approved" },
      );
      expectDenied(wrongClass.error);

      const author = await member.client.rpc("review_class_assignment", {
        p_assignment_id: publishedAssignmentId,
        p_decision: "approved",
      });
      expectDenied(author.error);
    });

    it("lets the class admin approve and records the reviewer", async () => {
      const { data, error } = await classAdmin.client.rpc(
        "review_class_assignment",
        { p_assignment_id: publishedAssignmentId, p_decision: "approved" },
      );

      expect(error).toBeNull();
      expect(data).toBe("published");

      const { data: row } = await classAdmin.client
        .from("assignments")
        .select("status, reviewed_by")
        .eq("id", publishedAssignmentId)
        .single();

      expect(row?.status).toBe("published");
      expect(row?.reviewed_by).toBe(classAdmin.id);
    });

    it("refuses to review your own submission", async () => {
      const ownSubmission = await submitAssignment(
        classAdmin,
        classA,
        subjectIdA,
        "Self review authorization target",
      );

      const { error } = await classAdmin.client.rpc("review_class_assignment", {
        p_assignment_id: ownSubmission,
        p_decision: "approved",
      });

      expectDenied(error);
    });
  });

  describe("moderate_assignment", () => {
    let assignmentId = "";

    it("publishes a class assignment before moderation", async () => {
      assignmentId = await submitAssignment(
        member,
        classA,
        subjectIdA,
        "Moderation target assignment",
      );

      const { error } = await classAdmin.client.rpc("review_class_assignment", {
        p_assignment_id: assignmentId,
        p_decision: "approved",
      });

      expect(error).toBeNull();
    });

    it("refuses anonymous, unrelated, and class members", async () => {
      const anonymous = await anon.rpc("moderate_assignment", {
        p_assignment_id: assignmentId,
        p_action: "unpublish",
        p_reason: "Anonymous moderation must fail.",
      });
      expectDenied(anonymous.error);

      const unrelated = await outsider.client.rpc("moderate_assignment", {
        p_assignment_id: assignmentId,
        p_action: "unpublish",
        p_reason: "An outsider must not moderate.",
      });
      expectDenied(unrelated.error);

      const plainMember = await member.client.rpc("moderate_assignment", {
        p_assignment_id: assignmentId,
        p_action: "unpublish",
        p_reason: "A plain member must not moderate.",
      });
      expectDenied(plainMember.error);
    });

    it("lets the class admin unpublish with a reason", async () => {
      const { data, error } = await classAdmin.client.rpc(
        "moderate_assignment",
        {
          p_assignment_id: assignmentId,
          p_action: "unpublish",
          p_reason: "Authorization matrix: hide this assignment.",
        },
      );

      expect(error).toBeNull();
      expect(data).toBe("unpublished");
    });

    it("refuses restore to a class admin and allows it to a platform admin", async () => {
      const classAdminRestore = await classAdmin.client.rpc(
        "moderate_assignment",
        { p_assignment_id: assignmentId, p_action: "restore" },
      );
      expectDenied(classAdminRestore.error);

      const { data, error } = await platformAdmin.client.rpc(
        "moderate_assignment",
        { p_assignment_id: assignmentId, p_action: "restore" },
      );

      expect(error).toBeNull();
      expect(data).toBe("published");
    });
  });

  describe("accept_class_invitation", () => {
    it("refuses an anonymous caller even with a valid token", async () => {
      const { token } = await createInvitation(classAdmin, classA);

      const { error } = await anon.rpc("accept_class_invitation", {
        p_token: token,
      });

      expectDenied(error);
    });

    it("lets an invited user join once and treats replay as idempotent", async () => {
      const { token, invitationId } = await createInvitation(
        classAdmin,
        classA,
      );

      const first = await invitee.client.rpc("accept_class_invitation", {
        p_token: token,
      });
      expect(first.error).toBeNull();
      expect(first.data).toBe(classA);

      const second = await invitee.client.rpc("accept_class_invitation", {
        p_token: token,
      });
      expect(second.error).toBeNull();
      expect(second.data).toBe(classA);

      const { data: invitation } = await classAdmin.client
        .from("class_invitations")
        .select("used_count")
        .eq("id", invitationId)
        .single();

      expect(invitation?.used_count).toBe(1);

      const { data: membership } = await invitee.client
        .from("class_members")
        .select("joined_via")
        .eq("class_id", classA)
        .eq("user_id", invitee.id)
        .single();

      expect(membership?.joined_via).toBe("invitation");
    });

    it("refuses an invitation restricted to another email", async () => {
      // verificationStudent has not joined class A yet; an existing member is
      // returned early by the idempotent path before the email check runs.
      const { token } = await createInvitation(classAdmin, classA, {
        emailRestriction: outsider.email,
      });

      const { error } = await verificationStudent.client.rpc(
        "accept_class_invitation",
        { p_token: token },
      );

      expectDenied(error);
    });

    it("refuses a revoked invitation", async () => {
      const { token, invitationId } = await createInvitation(
        classAdmin,
        classA,
      );

      const { error: revokeError } = await classAdmin.client.rpc(
        "revoke_class_invitation",
        { p_invitation_id: invitationId },
      );
      expect(revokeError).toBeNull();

      const { error } = await outsider.client.rpc("accept_class_invitation", {
        p_token: token,
      });

      expectDenied(error, "22023");
    });
  });

  describe("decide_class_verification", () => {
    let requestId = "";

    it("lets any authenticated student open a verification request", async () => {
      const { data, error } = await verificationStudent.client.rpc(
        "begin_class_verification",
        {
          p_class_id: classA,
          p_statement: "I maintain records for this class.",
        },
      );

      expect(error).toBeNull();
      expect(typeof data).toBe("string");
      requestId = data as string;
    });

    it("refuses every non-platform-admin actor", async () => {
      const { error: evidenceError } = await verificationStudent.client.rpc(
        "add_class_verification_evidence",
        {
          p_request_id: requestId,
          p_storage_path: `${verificationStudent.id}/${requestId}/proof.pdf`,
          p_original_filename: "proof.pdf",
          p_mime_type: "application/pdf",
          p_file_size: 1024,
        },
      );
      expect(evidenceError).toBeNull();

      const { error: submitError } = await verificationStudent.client.rpc(
        "submit_class_verification",
        { p_request_id: requestId },
      );
      expect(submitError).toBeNull();

      for (const actor of [
        anon,
        outsider.client,
        member.client,
        classAdmin.client,
        otherClassAdmin.client,
      ]) {
        const { error } = await actor.rpc("decide_class_verification", {
          p_request_id: requestId,
          p_decision: "approve",
        });
        expectDenied(error);
      }
    });

    it("refuses to review your own request", async () => {
      const { data: ownRequest } = await platformAdmin.client.rpc(
        "begin_class_verification",
        { p_class_id: classB, p_statement: "A platform admin's own request." },
      );

      const { error: evidenceError } = await platformAdmin.client.rpc(
        "add_class_verification_evidence",
        {
          p_request_id: ownRequest,
          p_storage_path: `${platformAdmin.id}/${ownRequest}/proof.pdf`,
          p_original_filename: "proof.pdf",
          p_mime_type: "application/pdf",
          p_file_size: 1024,
        },
      );
      expect(evidenceError).toBeNull();

      const { error: submitError } = await platformAdmin.client.rpc(
        "submit_class_verification",
        { p_request_id: ownRequest },
      );
      expect(submitError).toBeNull();

      const { error } = await platformAdmin.client.rpc(
        "decide_class_verification",
        { p_request_id: ownRequest, p_decision: "approve" },
      );

      expectDenied(error);
    });

    it("lets a platform admin request a revision and then approve", async () => {
      const { data: revisionStatus, error: revisionError } =
        await platformAdmin.client.rpc("decide_class_verification", {
          p_request_id: requestId,
          p_decision: "request_revision",
          p_note: "Please add an appointment letter.",
        });

      expect(revisionError).toBeNull();
      expect(revisionStatus).toBe("needs_revision");

      const { data: approvedStatus, error: approveError } =
        await platformAdmin.client.rpc("decide_class_verification", {
          p_request_id: requestId,
          p_decision: "approve",
        });

      expect(approveError).toBeNull();
      expect(approvedStatus).toBe("verified");

      const { data: membership } = await classAdmin.client
        .from("class_members")
        .select("joined_via")
        .eq("class_id", classA)
        .eq("user_id", verificationStudent.id)
        .single();

      expect(membership?.joined_via).toBe("admin_assignment");

      // assigned_by is deliberately not granted to authenticated clients, so
      // the service role is the only way to verify who granted the access.
      const { data: adminRow } = await admin
        .from("class_admins")
        .select("assigned_by")
        .eq("class_id", classA)
        .eq("user_id", verificationStudent.id)
        .single();

      expect(adminRow?.assigned_by).toBe(platformAdmin.id);
    });
  });

  describe("complete_leave_forwarding", () => {
    let leaveRequestId = "";

    it("refuses anonymous, the owner, unrelated users, and another class admin", async () => {
      leaveRequestId = await createSubmittedLeaveRequest(member, classA);

      const forwardingArgs = {
        p_class_id: classA,
        p_request_ids: [leaveRequestId],
        p_recipient_name: "Dr. Example",
        p_recipient_email: "lecturer@example.test",
        p_report_reference: `AUTHZ-${suffix}`,
        p_report_format: "summary",
        p_idempotency_key: randomUUID(),
      };

      const anonymous = await anon.rpc(
        "complete_leave_forwarding",
        forwardingArgs,
      );
      expectDenied(anonymous.error);

      const owner = await member.client.rpc(
        "complete_leave_forwarding",
        forwardingArgs,
      );
      expectDenied(owner.error);

      const unrelated = await outsider.client.rpc(
        "complete_leave_forwarding",
        forwardingArgs,
      );
      expectDenied(unrelated.error);

      const wrongClass = await otherClassAdmin.client.rpc(
        "complete_leave_forwarding",
        forwardingArgs,
      );
      expectDenied(wrongClass.error);
    });

    it("lets the class admin forward and replays the idempotency key", async () => {
      const idempotencyKey = randomUUID();
      const args = {
        p_class_id: classA,
        p_request_ids: [leaveRequestId],
        p_recipient_name: "Dr. Example",
        p_recipient_email: "lecturer@example.test",
        p_report_reference: `AUTHZ-${suffix}`,
        p_report_format: "summary",
        p_idempotency_key: idempotencyKey,
      };

      const first = await classAdmin.client.rpc(
        "complete_leave_forwarding",
        args,
      );

      expect(first.error).toBeNull();

      const firstRow = Array.isArray(first.data) ? first.data[0] : null;

      expect(firstRow?.request_count).toBe(1);
      expect(typeof firstRow?.reference).toBe("string");

      const replay = await classAdmin.client.rpc(
        "complete_leave_forwarding",
        args,
      );

      expect(replay.error).toBeNull();

      const replayRow = Array.isArray(replay.data) ? replay.data[0] : null;

      expect(replayRow?.id).toBe(firstRow?.id);
      expect(replayRow?.reference).toBe(firstRow?.reference);

      const { data: request } = await classAdmin.client
        .from("leave_requests")
        .select("status")
        .eq("id", leaveRequestId)
        .single();

      expect(request?.status).toBe("forwarded");
    });
  });

  describe("rsvp_discussion_session", () => {
    let sessionId = "";

    it("lets the class admin schedule a session", async () => {
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const endsAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

      const { data, error } = await classAdmin.client.rpc(
        "create_discussion_session",
        {
          p_class_id: classA,
          p_title: "Authorization matrix session",
          p_description: "A session used to verify RSVP authorization.",
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
          p_time_zone: TIME_ZONE,
          p_session_type: "online",
          p_meeting_url: "https://meet.example.test/authz",
          p_capacity: 1,
          p_visibility: "class_members",
        },
      );

      expect(error).toBeNull();
      expect(typeof data).toBe("string");
      sessionId = data as string;
    });

    it("refuses anonymous, unrelated, and another class admin", async () => {
      const anonymous = await anon.rpc("rsvp_discussion_session", {
        p_session_id: sessionId,
        p_status: "going",
      });
      expectDenied(anonymous.error);

      const unrelated = await outsider.client.rpc("rsvp_discussion_session", {
        p_session_id: sessionId,
        p_status: "going",
      });
      expectDenied(unrelated.error);

      const wrongClass = await otherClassAdmin.client.rpc(
        "rsvp_discussion_session",
        { p_session_id: sessionId, p_status: "going" },
      );
      expectDenied(wrongClass.error);
    });

    it("lets a class member RSVP and enforces capacity", async () => {
      const { data, error } = await member.client.rpc(
        "rsvp_discussion_session",
        { p_session_id: sessionId, p_status: "going" },
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "going", going_count: 1 });

      const full = await invitee.client.rpc("rsvp_discussion_session", {
        p_session_id: sessionId,
        p_status: "going",
      });
      expectDenied(full.error, "SS001");
    });

    it("rejects an invalid status", async () => {
      const { error } = await member.client.rpc("rsvp_discussion_session", {
        p_session_id: sessionId,
        p_status: "attending",
      });

      expectDenied(error, "22023");
    });

    it("refuses a cancelled session", async () => {
      const { error: cancelError } = await classAdmin.client.rpc(
        "set_discussion_session_status",
        { p_session_id: sessionId, p_status: "cancelled" },
      );
      expect(cancelError).toBeNull();

      const { error } = await member.client.rpc("rsvp_discussion_session", {
        p_session_id: sessionId,
        p_status: "maybe",
      });

      expectDenied(error, "SS003");
    });
  });

  describe("developer_class_metrics", () => {
    it("refuses anonymous and authenticated callers", async () => {
      const anonymous = await anon.rpc("developer_class_metrics", {
        p_limit: 10,
      });
      expectDenied(anonymous.error);

      const authenticated = await member.client.rpc("developer_class_metrics", {
        p_limit: 10,
      });
      expectDenied(authenticated.error);
    });

    it("returns aggregate counts for the service role only", async () => {
      const { data, error } = await admin.rpc("developer_class_metrics", {
        p_limit: 500,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      // The integration client is untyped, so the RPC payload is asserted here.
      const rows = (data ?? []) as { class_id: string; status: string }[];
      const row = rows.find((item) => item.class_id === classA);

      if (!row) {
        throw new Error("The created class is missing from the metrics");
      }

      expect(Object.keys(row).sort()).toEqual([
        "academic_year",
        "admin_count",
        "attendance_count",
        "class_code",
        "class_id",
        "invitation_count",
        "last_activity_at",
        "leave_request_count",
        "member_count",
        "name",
        "pending_review_count",
        "published_count",
        "semester",
        "session_count",
        "status",
      ]);
      expect(row.status).toBe("active");
    });
  });

  describe("purge_notification_deliveries", () => {
    it("refuses anonymous and authenticated callers", async () => {
      const anonymous = await anon.rpc("purge_notification_deliveries", {
        p_retention_days: 180,
      });
      expectDenied(anonymous.error);

      const authenticated = await member.client.rpc(
        "purge_notification_deliveries",
        { p_retention_days: 180 },
      );
      expectDenied(authenticated.error);
    });

    it("deletes terminal rows past retention but keeps pending rows", async () => {
      const assignmentId = await submitAssignment(
        classAdmin,
        classA,
        subjectIdA,
        `Retention ${suffix}`,
      );
      const oldTimestamp = new Date(
        Date.now() - 400 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: inserted, error: insertError } = await admin
        .from("notification_deliveries")
        .insert([
          {
            user_id: member.id,
            assignment_id: assignmentId,
            reminder_type: "24h",
            deadline_at: oldTimestamp,
            scheduled_for: oldTimestamp,
            status: "sent",
            delivered_at: oldTimestamp,
            updated_at: oldTimestamp,
          },
          {
            user_id: member.id,
            assignment_id: assignmentId,
            reminder_type: "3h",
            deadline_at: oldTimestamp,
            scheduled_for: oldTimestamp,
            status: "pending",
            updated_at: oldTimestamp,
          },
        ])
        .select("id, status");

      expect(insertError).toBeNull();
      expect(inserted).toHaveLength(2);

      const sentId = inserted?.find((row) => row.status === "sent")?.id;
      const pendingId = inserted?.find((row) => row.status === "pending")?.id;

      if (!sentId || !pendingId) {
        throw new Error("Could not create the retention fixtures");
      }

      const { error } = await admin.rpc("purge_notification_deliveries", {
        p_retention_days: 180,
      });

      expect(error).toBeNull();

      const { data: remaining, error: readError } = await admin
        .from("notification_deliveries")
        .select("id, status")
        .in("id", [sentId, pendingId]);

      expect(readError).toBeNull();
      expect(remaining).toEqual([{ id: pendingId, status: "pending" }]);
    });
  });
});
