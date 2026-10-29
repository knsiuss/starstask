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

    expect(members).toEqual([{ user_id: member.id }]);
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
      p_assignment_type: "essay",
      p_tags: ["rls"],
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    submissionId = data as string;

    const { data: anonRows } = await anon
      .from("assignments")
      .select("id")
      .eq("id", submissionId);
    expect(anonRows).toEqual([]);

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

  it("publishes an approved submission for anonymous discovery", async () => {
    const { data, error } = await applicant.client.rpc(
      "review_class_assignment",
      {
        p_assignment_id: submissionId,
        p_decision: "approved",
      },
    );

    expect(error).toBeNull();
    expect(data).toBe("published");

    const { data: publicRows } = await anon
      .from("assignments")
      .select("id, status")
      .eq("id", submissionId);

    expect(publicRows).toEqual([{ id: submissionId, status: "published" }]);

    const { data: listed, error: listError } = await anon.rpc(
      "list_assignments",
      { p_class_id: classId },
    );

    expect(listError).toBeNull();
    expect((listed ?? []).map((row: { id: string }) => row.id)).toContain(
      submissionId,
    );
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

    const { data: publicRows } = await anon
      .from("assignments")
      .select("id")
      .eq("id", nextSubmission);
    expect(publicRows).toEqual([]);
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

  it("does not let a client archive a class", async () => {
    const { error } = await applicant.client.rpc("set_class_status", {
      p_class_id: classId,
      p_status: "archived",
    });

    expect(error).not.toBeNull();

    const { data } = await anon
      .from("classes")
      .select("status")
      .eq("id", classId)
      .single();
    expect(data?.status).toBe("active");
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

    const { data: publicRows } = await anon
      .from("assignments")
      .select("id")
      .eq("id", submissionId);
    expect(publicRows).toEqual([]);
  });

  it("does not let a class admin reverse a platform moderation decision", async () => {
    const { error } = await applicant.client.rpc("moderate_assignment", {
      p_assignment_id: submissionId,
      p_action: "restore",
    });

    expect(error).not.toBeNull();

    const { data: publicRows } = await anon
      .from("assignments")
      .select("id")
      .eq("id", submissionId);
    expect(publicRows).toEqual([]);
  });
});
