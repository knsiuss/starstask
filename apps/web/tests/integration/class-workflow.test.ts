import { createHash, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Authorization tests for class applications, memberships, invitations, and
 * the review/publication workflow.
 *
 * Requires the same disposable Supabase project as the RLS suite:
 * SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY.
 * The suite is skipped when they are absent, so ordinary `pnpm test` never
 * needs secrets.
 */
const url = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const hasEnv = Boolean(url && anonKey && serviceRoleKey);
const suffix = randomUUID().slice(0, 8);
const PASSWORD = `test-${randomUUID()}`;

type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

let admin: SupabaseClient;
let anon: SupabaseClient;
let applicant: TestUser;
let member: TestUser;
let platformAdmin: TestUser;
let classId = "";
let classSlug = "";
let courseName = "";
let universityId = "";
let applicationId = "";
let invitationId = "";
let submissionId = "";

async function createTestUser(label: string): Promise<TestUser> {
  const email = `starstask-class-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Class ${label.toUpperCase()}` },
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
    throw new Error(
      `Could not sign in test user ${label}: ${signInError.message}`,
    );
  }

  return { id: data.user.id, email, client };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

describe.skipIf(!hasEnv)("class workflow authorization", () => {
  beforeAll(async () => {
    admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    applicant = await createTestUser("applicant");
    member = await createTestUser("member");
    platformAdmin = await createTestUser("platform");

    // The audit_logs university_id future-rows guard requires university_id on
    // every post-2026-11-05 audit row. Audits from apply_for_class (pre-class
    // lifecycle) have no class_id to resolve a tenant, so without any
    // membership the insert violates the constraint. Seed a disposable tenant
    // with the applicant and platform admin so audits resolve.
    const { data: uni, error: uniError } = await admin
      .from("universities")
      .insert({
        slug: `rls-class-uni-${suffix}`,
        name: `RLS Class Uni ${suffix}`,
        status: "active",
      })
      .select("id")
      .single();

    if (uniError || !uni) {
      throw new Error(`Could not seed university: ${uniError?.message}`);
    }

    universityId = uni.id as string;

    const { error: memberError } = await admin
      .from("university_memberships")
      .insert([
        {
          user_id: applicant.id,
          university_id: universityId,
          role: "student",
          status: "active",
        },
        {
          user_id: member.id,
          university_id: universityId,
          role: "student",
          status: "active",
        },
        {
          user_id: platformAdmin.id,
          university_id: universityId,
          role: "student",
          status: "active",
        },
      ]);

    if (memberError) {
      throw new Error(
        `Could not seed university memberships: ${memberError.message}`,
      );
    }

    const { error: grantError } = await admin
      .from("platform_admins")
      .insert({ user_id: platformAdmin.id });

    if (grantError) {
      throw new Error(`Could not grant platform admin: ${grantError.message}`);
    }
  });

  afterAll(async () => {
    // Classes must go first: classes.course_id is ON DELETE RESTRICT.
    if (admin && courseName) {
      await admin.from("classes").delete().eq("course_name", courseName);
      await admin.from("courses").delete().eq("name", courseName);
    }

    if (universityId) {
      await admin
        .from("university_memberships")
        .delete()
        .eq("university_id", universityId);
      await admin.from("universities").delete().eq("id", universityId);
    }

    for (const user of [applicant, member, platformAdmin]) {
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });

  it("lets any authenticated user apply for a class", async () => {
    classSlug = `rls-class-${suffix}`;
    courseName = `RLS Class Course ${suffix}`;

    const { data, error } = await applicant.client.rpc("apply_for_class", {
      p_proposed_slug: classSlug,
      p_proposed_name: `RLS Class ${suffix}`,
      p_course_name: courseName,
      p_semester: "1",
      p_academic_year: "2025/2026",
      p_description: "A class used to verify the application workflow.",
      p_reason:
        "The applicant maintains the assignment archive for this class.",
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    applicationId = data as string;
  });

  it("blocks a duplicate open application for the same slug", async () => {
    const { error } = await applicant.client.rpc("apply_for_class", {
      p_proposed_slug: classSlug,
      p_proposed_name: `Duplicate ${suffix}`,
      p_course_name: courseName,
      p_semester: "1",
      p_academic_year: "2025/2026",
      p_description: "A duplicate application that must not be stored.",
      p_reason: "This second application should be rejected as a duplicate.",
    });

    expect(error).not.toBeNull();
  });

  it("does not let the applicant approve their own application", async () => {
    const { error } = await applicant.client.rpc("decide_class_application", {
      p_application_id: applicationId,
      p_decision: "approved",
      p_grant_class_admin: true,
    });

    expect(error).not.toBeNull();
  });

  it("does not let a third party read the application", async () => {
    const { data, error } = await member.client
      .from("class_applications")
      .select("id")
      .eq("id", applicationId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not let the applicant assign themselves a class admin role", async () => {
    const { error } = await applicant.client.rpc("assign_class_admin", {
      p_class_id: randomUUID(),
      p_user_id: applicant.id,
    });

    expect(error).not.toBeNull();
  });

  it("does not let a user grant themselves platform admin", async () => {
    const { error } = await applicant.client
      .from("platform_admins")
      .insert({ user_id: applicant.id });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", applicant.id);
    expect(data).toEqual([]);
  });

  it("lets a platform admin approve and optionally grant class admin", async () => {
    const { data, error } = await platformAdmin.client.rpc(
      "decide_class_application",
      {
        p_application_id: applicationId,
        p_decision: "approved",
        p_note: "Approved by the platform review test.",
        p_grant_class_admin: true,
      },
    );

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    classId = data as string;
  });

  it("records the decision and reviewer in the application history", async () => {
    const { data, error } = await applicant.client
      .from("class_applications")
      .select("status, reviewed_by, created_class_id")
      .eq("id", applicationId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("approved");
    expect(data?.created_class_id).toBe(classId);
    expect(data?.reviewed_by).toBe(platformAdmin.id);

    const { data: history } = await applicant.client
      .from("class_application_reviews")
      .select("decision")
      .eq("application_id", applicationId);

    expect(history).toEqual([{ decision: "approved" }]);
  });

  it("makes the approved class public while keeping applications private", async () => {
    const { data: classes } = await anon
      .from("classes")
      .select("id, slug")
      .eq("slug", classSlug);

    expect(classes).toEqual([{ id: classId, slug: classSlug }]);

    const { error: applicationError } = await anon
      .from("class_applications")
      .select("id");
    expect(applicationError).not.toBeNull();

    const { error: membersError } = await anon
      .from("class_members")
      .select("user_id");
    expect(membersError).not.toBeNull();
  });

  it("adds the applicant as a member and explicit class admin", async () => {
    const { data: members } = await applicant.client
      .from("class_members")
      .select("user_id, joined_via")
      .eq("class_id", classId);

    expect(members).toEqual([
      { user_id: applicant.id, joined_via: "platform_assignment" },
    ]);

    const { data: admins } = await applicant.client
      .from("class_admins")
      .select("user_id")
      .eq("class_id", classId);

    expect(admins).toEqual([{ user_id: applicant.id }]);
  });

  it("lets only a class admin change how the class is joined", async () => {
    const readPolicy = async () => {
      const { data } = await admin
        .from("classes")
        .select("join_policy")
        .eq("id", classId)
        .single();
      return data?.join_policy;
    };

    const { error } = await applicant.client.rpc("set_class_join_policy", {
      p_class_id: classId,
      p_policy: "open",
    });
    expect(error).toBeNull();
    expect(await readPolicy()).toBe("open");

    const { data: policyRow, error: policyReadError } = await applicant.client
      .from("classes")
      .select("join_policy")
      .eq("id", classId)
      .single();
    expect(policyReadError).toBeNull();
    expect(policyRow?.join_policy).toBe("open");

    const { error: anonReadError } = await anon
      .from("classes")
      .select("join_policy")
      .eq("id", classId);
    expect(anonReadError?.code).toBe("42501");

    const { error: invalidError } = await applicant.client.rpc(
      "set_class_join_policy",
      { p_class_id: classId, p_policy: "public" },
    );
    expect(invalidError?.code).toBe("22023");

    const { error: memberError } = await member.client.rpc(
      "set_class_join_policy",
      { p_class_id: classId, p_policy: "invitation" },
    );
    expect(memberError?.code).toBe("42501");

    const { error: anonError } = await anon.rpc("set_class_join_policy", {
      p_class_id: classId,
      p_policy: "invitation",
    });
    expect(anonError?.code).toBe("42501");

    expect(await readPolicy()).toBe("open");

    const { error: resetError } = await applicant.client.rpc(
      "set_class_join_policy",
      { p_class_id: classId, p_policy: "invitation" },
    );
    expect(resetError).toBeNull();
    expect(await readPolicy()).toBe("invitation");
  });

  it("hides class membership from unrelated signed-in users", async () => {
    const { data, error } = await member.client
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("never exposes invitation token hashes to the class admin", async () => {
    const { error } = await applicant.client
      .from("class_invitations")
      .select("token_hash")
      .eq("class_id", classId);

    expect(error).not.toBeNull();
  });

  it("creates an invitation link and lets an authenticated user join once", async () => {
    const token =
      randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data, error } = await applicant.client.rpc(
      "create_class_invitation",
      {
        p_class_id: classId,
        p_token_hash: hashToken(token),
        p_expires_at: expiresAt,
        p_max_uses: 2,
      },
    );

    expect(error).toBeNull();
    invitationId = data as string;

    const { data: joined, error: acceptError } = await member.client.rpc(
      "accept_class_invitation",
      { p_token: token },
    );

    expect(acceptError).toBeNull();
    expect(joined).toBe(classId);

    const { data: members } = await member.client
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId);

    const memberIds = (members ?? []).map((row) => row.user_id).sort();
    expect(memberIds).toEqual([applicant.id, member.id].sort());
  });

  it("treats a repeat acceptance as idempotent and does not consume a use", async () => {
    const { data: invitation } = await applicant.client
      .from("class_invitations")
      .select("used_count")
      .eq("id", invitationId)
      .single();

    expect(invitation?.used_count).toBe(1);
  });

  it("rejects a revoked invitation", async () => {
    const token =
      randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: id } = await applicant.client.rpc("create_class_invitation", {
      p_class_id: classId,
      p_token_hash: hashToken(token),
      p_expires_at: expiresAt,
      p_max_uses: 1,
    });

    const { error: revokeError } = await applicant.client.rpc(
      "revoke_class_invitation",
      { p_invitation_id: id },
    );
    expect(revokeError).toBeNull();

    const { error } = await platformAdmin.client.rpc(
      "accept_class_invitation",
      {
        p_token: token,
      },
    );

    expect(error).not.toBeNull();
  });

  it("rejects an invitation restricted to another email", async () => {
    const token =
      randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: createError } = await applicant.client.rpc(
      "create_class_invitation",
      {
        p_class_id: classId,
        p_token_hash: hashToken(token),
        p_expires_at: expiresAt,
        p_max_uses: 1,
        p_email_restriction: member.email,
      },
    );
    expect(createError).toBeNull();

    const { error } = await platformAdmin.client.rpc(
      "accept_class_invitation",
      {
        p_token: token,
      },
    );

    expect(error).not.toBeNull();
  });

  it("submits a class assignment as pending review and keeps it private", async () => {
    const { data, error } = await member.client.rpc("submit_class_assignment", {
      p_class_id: classId,
      p_title: "RLS class submission",
      p_description: "A complete submission used to verify the review flow.",
      p_assignment_type: "individual",
      p_tags: ["rls"],
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    submissionId = data as string;

    const { data: anonRows, error: anonError } = await anon
      .from("assignments")
      .select("id")
      .eq("id", submissionId);
    expect(anonError?.code).toBe("42501");
    expect(anonRows).toBeNull();

    const { data: adminRows } = await applicant.client
      .from("assignments")
      .select("id, status")
      .eq("id", submissionId);
    expect(adminRows).toEqual([{ id: submissionId, status: "pending_review" }]);
  });

  it("does not let a regular member review a submission", async () => {
    const { error } = await member.client.rpc("review_class_assignment", {
      p_assignment_id: submissionId,
      p_decision: "approved",
      p_reason: null,
    });

    expect(error).not.toBeNull();
  });

  it("does not let a reviewer forge publication with a direct update", async () => {
    const { error } = await applicant.client
      .from("assignments")
      .update({ status: "published" })
      .eq("id", submissionId);

    expect(error).not.toBeNull();
  });

  it("prevents reviewing your own submission", async () => {
    const { data: ownSubmission, error: submitError } =
      await applicant.client.rpc("submit_class_assignment", {
        p_class_id: classId,
        p_title: "Self review check",
        p_description:
          "A submission by the class admin that must not self-approve.",
        p_assignment_type: null,
        p_tags: [],
      });

    expect(submitError).toBeNull();

    const { error } = await applicant.client.rpc("review_class_assignment", {
      p_assignment_id: ownSubmission,
      p_decision: "approved",
    });

    expect(error).not.toBeNull();
  });

  it("publishes an approved submission for signed-in discovery only", async () => {
    const { data, error } = await applicant.client.rpc(
      "review_class_assignment",
      {
        p_assignment_id: submissionId,
        p_decision: "approved",
      },
    );

    expect(error).toBeNull();
    expect(data).toBe("published");

    const { data: anonymousRows, error: anonymousError } = await anon
      .from("assignments")
      .select("id, status")
      .eq("id", submissionId);

    expect(anonymousError?.code).toBe("42501");
    expect(anonymousRows).toBeNull();

    const { data: signedInRows } = await member.client
      .from("assignments")
      .select("id, status")
      .eq("id", submissionId);

    expect(signedInRows).toEqual([{ id: submissionId, status: "published" }]);

    const { data: listed, error: listError } = await member.client.rpc(
      "list_assignments",
      { p_class_id: classId },
    );

    expect(listError).toBeNull();
    expect((listed ?? []).map((row: { id: string }) => row.id)).toContain(
      submissionId,
    );
  });

  it("notifies the reporter when a report is reviewed", async () => {
    const { data: reportId, error: reportError } =
      await platformAdmin.client.rpc("report_assignment", {
        p_assignment_id: submissionId,
        p_reason: "wrong_details",
        p_note: "The brief lists the wrong submission format.",
      });

    expect(reportError).toBeNull();
    expect(reportId).toBeTruthy();

    const { error: reviewError } = await applicant.client.rpc(
      "review_assignment_report",
      {
        p_report_id: reportId,
        p_status: "resolved",
        p_note: "Corrected the format in the brief.",
      },
    );

    expect(reviewError).toBeNull();

    const { data } = await admin
      .from("notification_events")
      .select("kind, payload")
      .eq("user_id", platformAdmin.id)
      .eq("kind", "assignment_report_reviewed");

    expect(data).toHaveLength(1);
    expect(data?.[0]?.payload).toMatchObject({
      title: "Report resolved",
      url: `/assignments/${submissionId}`,
    });
  });

  it("requires a rejection reason and keeps a rejected submission private", async () => {
    const { data: nextSubmission } = await member.client.rpc(
      "submit_class_assignment",
      {
        p_class_id: classId,
        p_title: "Rejected submission",
        p_description: "A submission used to verify the rejection requirement.",
        p_assignment_type: null,
        p_tags: [],
      },
    );

    const { error: noReasonError } = await applicant.client.rpc(
      "review_class_assignment",
      {
        p_assignment_id: nextSubmission,
        p_decision: "rejected",
      },
    );
    expect(noReasonError).not.toBeNull();

    const { error } = await applicant.client.rpc("review_class_assignment", {
      p_assignment_id: nextSubmission,
      p_decision: "rejected",
      p_reason: "Remove the private student list before resubmitting.",
    });
    expect(error).toBeNull();

    const { data: rejected } = await member.client
      .from("assignments")
      .select("status, rejection_reason")
      .eq("id", nextSubmission)
      .single();

    expect(rejected?.status).toBe("rejected");
    expect(rejected?.rejection_reason).toContain("private student list");

    const { data: publicRows, error: publicError } = await anon
      .from("assignments")
      .select("id")
      .eq("id", nextSubmission);
    expect(publicError?.code).toBe("42501");
    expect(publicRows).toBeNull();
  });

  it("lets only the class admin and platform admins read the audit trail", async () => {
    const { data: classAdminRows } = await applicant.client
      .from("audit_logs")
      .select("action")
      .eq("class_id", classId);

    expect(
      classAdminRows?.some((row) => row.action === "assignment_approved"),
    ).toBe(true);

    const { data: memberRows } = await member.client
      .from("audit_logs")
      .select("action")
      .eq("class_id", classId);

    expect(memberRows).toEqual([]);
  });

  describe("class lifecycle and duplicate prevention", () => {
    const classCode = `TST-${suffix}`;
    let courseId = "";

    beforeAll(async () => {
      const { data, error } = await admin
        .from("classes")
        .select("course_id")
        .eq("id", classId)
        .single();

      if (error || !data?.course_id) {
        throw new Error("Could not read the approved class course id");
      }

      courseId = data.course_id;

      const { error: codeError } = await admin
        .from("classes")
        .update({ class_code: classCode })
        .eq("id", classId);

      if (codeError) {
        throw new Error(`Could not set the class code: ${codeError.message}`);
      }
    });

    async function readStatus() {
      const { data } = await admin
        .from("classes")
        .select("status")
        .eq("id", classId)
        .single();

      return data?.status;
    }

    it("does not let a regular member archive a class", async () => {
      const { error } = await member.client.rpc("set_class_status", {
        p_class_id: classId,
        p_status: "archived",
      });

      expect(error?.code).toBe("42501");
      expect(await readStatus()).toBe("active");
    });

    it("lets a class admin archive and restore without losing history", async () => {
      const { error: archiveError } = await applicant.client.rpc(
        "set_class_status",
        { p_class_id: classId, p_status: "archived" },
      );

      expect(archiveError).toBeNull();
      expect(await readStatus()).toBe("archived");

      const { data: publicRows } = await anon.rpc("list_classes", {
        p_search: classCode,
      });
      expect(
        (publicRows ?? []).map((row: { id: string }) => row.id),
      ).not.toContain(classId);

      const { data: archivedRows } = await platformAdmin.client.rpc(
        "list_platform_classes",
        { p_search: classSlug, p_status: "archived" },
      );
      expect(archivedRows?.[0]?.id).toBe(classId);

      const { count: memberCount } = await admin
        .from("class_members")
        .select("user_id", { count: "exact", head: true })
        .eq("class_id", classId);
      expect(memberCount).toBeGreaterThanOrEqual(2);

      const { count: assignmentCount } = await admin
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId);
      expect(assignmentCount).toBeGreaterThanOrEqual(1);

      const { data: archiveAudit } = await applicant.client
        .from("audit_logs")
        .select("action")
        .eq("class_id", classId)
        .eq("action", "class_archived");
      expect(archiveAudit?.length).toBeGreaterThanOrEqual(1);

      const { error: restoreError } = await applicant.client.rpc(
        "set_class_status",
        { p_class_id: classId, p_status: "active" },
      );

      expect(restoreError).toBeNull();
      expect(await readStatus()).toBe("active");

      const { data: restoreAudit } = await applicant.client
        .from("audit_logs")
        .select("action")
        .eq("class_id", classId)
        .eq("action", "class_restored");
      expect(restoreAudit?.length).toBeGreaterThanOrEqual(1);

      const { data: restoredRows } = await anon.rpc("list_classes", {
        p_search: classCode,
      });
      expect(
        (restoredRows ?? []).map((row: { id: string }) => row.id),
      ).toContain(classId);
    });

    it("rejects moving an active class back to draft", async () => {
      const { error } = await applicant.client.rpc("set_class_status", {
        p_class_id: classId,
        p_status: "draft",
      });

      expect(error?.code).toBe("22023");
      expect(await readStatus()).toBe("active");
    });

    it("lets a platform admin archive and restore the class", async () => {
      const { error: archiveError } = await platformAdmin.client.rpc(
        "set_class_status",
        { p_class_id: classId, p_status: "archived" },
      );
      expect(archiveError).toBeNull();
      expect(await readStatus()).toBe("archived");

      const { error: restoreError } = await platformAdmin.client.rpc(
        "set_class_status",
        { p_class_id: classId, p_status: "active" },
      );
      expect(restoreError).toBeNull();
      expect(await readStatus()).toBe("active");
    });

    it("finds a duplicate by normalized code only inside the same period", async () => {
      const { data: samePeriod, error: sameError } = await applicant.client.rpc(
        "find_class_duplicates",
        {
          p_name: "A different class name",
          p_class_code: ` ${classCode.toLowerCase()} `,
          p_academic_year: "2025/2026",
          p_semester: "1",
        },
      );

      expect(sameError).toBeNull();
      expect(samePeriod).toHaveLength(1);
      expect(samePeriod?.[0]).toMatchObject({
        class_id: classId,
        class_code: classCode,
        code_match: true,
        name_match: false,
      });

      const { data: otherPeriod } = await applicant.client.rpc(
        "find_class_duplicates",
        {
          p_name: "A different class name",
          p_class_code: classCode,
          p_academic_year: "2099/2100",
          p_semester: "1",
        },
      );
      expect(otherPeriod).toEqual([]);

      const { data: excluded } = await applicant.client.rpc(
        "find_class_duplicates",
        {
          p_name: "A different class name",
          p_class_code: classCode,
          p_academic_year: "2025/2026",
          p_semester: "1",
          p_exclude_class_id: classId,
        },
      );
      expect(excluded).toEqual([]);

      const { data: byName } = await applicant.client.rpc(
        "find_class_duplicates",
        {
          p_name: `rls class ${suffix}`.toUpperCase(),
          p_class_code: null,
          p_academic_year: "2025/2026",
          p_semester: "1",
        },
      );
      expect(byName?.[0]?.name_match).toBe(true);
    });

    it("enforces code uniqueness per period and institution in the database", async () => {
      const base = {
        name: `Duplicate guard ${suffix}`,
        description: "A class used to verify the duplicate code constraint.",
        course_id: courseId,
        course_name: courseName,
        semester: "1",
        status: "active",
        created_by: applicant.id,
      };

      const { data: otherPeriod, error: otherPeriodError } = await admin
        .from("classes")
        .insert({
          ...base,
          slug: `dup-other-period-${suffix}`,
          class_code: classCode.toLowerCase(),
          academic_year: "2099/2100",
        })
        .select("id")
        .single();

      expect(otherPeriodError).toBeNull();
      expect(otherPeriod?.id).not.toBe(classId);

      const { error: duplicateError } = await admin
        .from("classes")
        .insert({
          ...base,
          slug: `dup-same-period-${suffix}`,
          class_code: classCode.toLowerCase(),
          academic_year: "2025/2026",
        })
        .select("id");

      expect(duplicateError?.code).toBe("23505");

      const { data: otherInstitution, error: institutionError } = await admin
        .from("classes")
        .insert({
          ...base,
          slug: `dup-other-institution-${suffix}`,
          class_code: classCode,
          academic_year: "2025/2026",
          institution: "Another University",
        })
        .select("id")
        .single();

      expect(institutionError).toBeNull();
      expect(otherInstitution?.id).not.toBe(classId);
    });

    it("refuses to permanently delete a class that has academic history", async () => {
      const { error } = await applicant.client.rpc("delete_class", {
        p_class_id: classId,
      });

      expect(error?.code).toBe("P0001");

      const { data: dependencies, error: dependencyError } =
        await applicant.client.rpc("get_class_dependencies", {
          p_class_id: classId,
        });

      expect(dependencyError).toBeNull();
      expect(dependencies?.[0]?.can_delete).toBe(false);
      expect(dependencies?.[0]?.has_history).toBe(true);
      expect(Number(dependencies?.[0]?.member_count)).toBeGreaterThanOrEqual(2);

      const { data: stillThere } = await admin
        .from("classes")
        .select("id")
        .eq("id", classId);
      expect(stillThere).toEqual([{ id: classId }]);
    });

    it("does not let a regular member delete a class", async () => {
      const { error } = await member.client.rpc("delete_class", {
        p_class_id: classId,
      });

      expect(error?.code).toBe("42501");
    });

    it("permanently deletes an empty draft class owned by its manager", async () => {
      const draftSlug = `draft-empty-${suffix}`;
      const { data: draft, error: draftError } = await admin
        .from("classes")
        .insert({
          slug: draftSlug,
          name: `Empty draft ${suffix}`,
          description: "An empty draft used to verify permanent deletion.",
          course_id: courseId,
          course_name: courseName,
          semester: "2",
          academic_year: "2098/2099",
          status: "draft",
          created_by: applicant.id,
        })
        .select("id")
        .single();

      expect(draftError).toBeNull();
      expect(draft?.id).toBeTruthy();

      const draftId = draft?.id as string;

      await admin.from("class_members").insert({
        class_id: draftId,
        user_id: applicant.id,
        joined_via: "platform_assignment",
      });
      await admin.from("class_admins").insert({
        class_id: draftId,
        user_id: applicant.id,
        assigned_by: platformAdmin.id,
      });

      const { data: dependencies } = await applicant.client.rpc(
        "get_class_dependencies",
        { p_class_id: draftId },
      );
      expect(dependencies?.[0]?.class_status).toBe("draft");
      expect(dependencies?.[0]?.can_delete).toBe(true);

      const { data: deleted, error: deleteError } = await applicant.client.rpc(
        "delete_class",
        { p_class_id: draftId },
      );

      expect(deleteError).toBeNull();
      expect(deleted).toBe(true);

      const { data: rows } = await admin
        .from("classes")
        .select("id")
        .eq("id", draftId);
      expect(rows).toEqual([]);

      const { data: audit } = await admin
        .from("audit_logs")
        .select("action, entity_id")
        .eq("entity_id", draftId)
        .eq("action", "class_deleted");
      expect(audit?.length).toBe(1);
    });
  });

  it("lets a platform admin moderate a published assignment", async () => {
    const { data, error } = await platformAdmin.client.rpc(
      "moderate_assignment",
      {
        p_assignment_id: submissionId,
        p_action: "unpublish",
        p_reason: "Moderation test: content requires review.",
      },
    );

    expect(error).toBeNull();
    expect(data).toBe("unpublished");

    const { data: publicRows, error: publicError } = await anon
      .from("assignments")
      .select("id")
      .eq("id", submissionId);
    expect(publicError?.code).toBe("42501");
    expect(publicRows).toBeNull();
  });

  it("does not let a class admin reverse a platform moderation decision", async () => {
    const { error } = await applicant.client.rpc("moderate_assignment", {
      p_assignment_id: submissionId,
      p_action: "restore",
    });

    expect(error).not.toBeNull();

    const { data: publicRows, error: publicError } = await anon
      .from("assignments")
      .select("id")
      .eq("id", submissionId);
    expect(publicError?.code).toBe("42501");
    expect(publicRows).toBeNull();
  });

  describe("platform admin read models", () => {
    const directoryArgs = {
      p_search: null,
      p_role: "all",
      p_onboarding: "all",
      p_limit: 20,
      p_offset: 0,
    };

    it("refuses the user directory to an ordinary member", async () => {
      const { error } = await member.client.rpc(
        "list_platform_users",
        directoryArgs,
      );

      expect(error?.code).toBe("42501");
    });

    it("returns safe profile fields and class counts to an admin", async () => {
      const { data, error } = await platformAdmin.client.rpc(
        "list_platform_users",
        directoryArgs,
      );

      expect(error).toBeNull();

      const row = data?.find(
        (item: { id: string }) => item.id === applicant.id,
      );

      expect(row).toBeTruthy();
      expect(row).not.toHaveProperty("full_name");
      expect(row).not.toHaveProperty("nim");
      expect(Number(row?.class_count)).toBeGreaterThanOrEqual(1);
      expect(Number(row?.total_count)).toBeGreaterThanOrEqual(3);
    });

    it("lists classes with aggregates for an admin only", async () => {
      const { error: memberError } = await member.client.rpc(
        "list_platform_classes",
        { p_search: classSlug, p_status: "all", p_limit: 20, p_offset: 0 },
      );

      expect(memberError?.code).toBe("42501");

      const { data, error } = await platformAdmin.client.rpc(
        "list_platform_classes",
        { p_search: classSlug, p_status: "active", p_limit: 20, p_offset: 0 },
      );

      expect(error).toBeNull();
      expect(data?.[0]?.slug).toBe(classSlug);
      expect(Number(data?.[0]?.member_count)).toBeGreaterThanOrEqual(1);
      expect(Number(data?.[0]?.admin_count)).toBeGreaterThanOrEqual(1);
    });

    it("computes overview counters from real rows", async () => {
      const { error: memberError } = await member.client.rpc(
        "get_platform_admin_overview",
      );

      expect(memberError?.code).toBe("42501");

      const { data, error } = await platformAdmin.client.rpc(
        "get_platform_admin_overview",
      );

      expect(error).toBeNull();

      const row = data?.[0];

      expect(Number(row?.total_users)).toBeGreaterThanOrEqual(3);
      expect(Number(row?.active_classes)).toBeGreaterThanOrEqual(1);
      expect(Number(row?.pending_verifications)).toBeGreaterThanOrEqual(0);
    });
  });
});
