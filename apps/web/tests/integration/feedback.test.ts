import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Ownership boundaries for in-app feedback.
 *
 * A note belongs to the user who wrote it. Nobody else may read it, and a
 * platform admin is the only role that can move it through triage. Requires
 * the disposable Supabase project used by the other integration suites; the
 * suite is skipped when SUPABASE_TEST_* is absent.
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
let owner: TestUser;
let outsider: TestUser;
let platformAdmin: TestUser;
let feedbackId = "";

async function createTestUser(label: string): Promise<TestUser> {
  const email = `starstask-feedback-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Feedback ${label}` },
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

describe.skipIf(!hasEnv)("feedback boundaries", () => {
  beforeAll(async () => {
    admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    owner = await createTestUser("owner");
    outsider = await createTestUser("outsider");
    platformAdmin = await createTestUser("platform");

    const { error } = await admin
      .from("platform_admins")
      .insert({ user_id: platformAdmin.id });

    if (error) {
      throw new Error(`Could not grant platform admin: ${error.message}`);
    }
  });

  afterAll(async () => {
    for (const user of [owner, outsider, platformAdmin]) {
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });

  it("rejects an anonymous visitor", async () => {
    const { error } = await anon.from("feedback_entries").select("id");

    expect(error?.code).toBe("42501");
  });

  it("lets the owner create and read their own note", async () => {
    const { data, error } = await owner.client
      .from("feedback_entries")
      .insert({
        user_id: owner.id,
        category: "bug",
        message: "The assignment filter reset after I changed the class.",
        page_path: "/assignments",
      })
      .select("id, status, category")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("open");
    expect(data?.category).toBe("bug");
    feedbackId = data?.id ?? "";

    const { data: own, error: readError } = await owner.client
      .from("feedback_entries")
      .select("id")
      .eq("id", feedbackId);

    expect(readError).toBeNull();
    expect(own).toHaveLength(1);
  });

  it("rejects inserting a note for another user", async () => {
    const { error } = await outsider.client.from("feedback_entries").insert({
      user_id: owner.id,
      category: "idea",
      message: "This insert claims to belong to a different user.",
    });

    expect(error).not.toBeNull();
  });

  it("hides another user's note", async () => {
    const { data, error } = await outsider.client
      .from("feedback_entries")
      .select("id")
      .eq("id", feedbackId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("refuses a status change from the owner", async () => {
    const { data, error } = await owner.client
      .from("feedback_entries")
      .update({ status: "resolved" })
      .eq("id", feedbackId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: unchanged } = await admin
      .from("feedback_entries")
      .select("status")
      .eq("id", feedbackId)
      .single();
    expect(unchanged?.status).toBe("open");
  });

  it("refuses a status change from an unrelated signed-in user", async () => {
    const { data, error } = await outsider.client
      .from("feedback_entries")
      .update({ status: "dismissed" })
      .eq("id", feedbackId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("lets a platform admin read every note", async () => {
    const { data, error } = await platformAdmin.client
      .from("feedback_entries")
      .select("id")
      .eq("id", feedbackId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("lets a platform admin move a note through triage", async () => {
    const { data, error } = await platformAdmin.client
      .from("feedback_entries")
      .update({ status: "reviewing" })
      .eq("id", feedbackId)
      .select("id, status");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: feedbackId, status: "reviewing" }]);
  });

  it("rejects an unknown status from the platform admin", async () => {
    const { error } = await platformAdmin.client
      .from("feedback_entries")
      .update({ status: "archived" })
      .eq("id", feedbackId);

    expect(error).not.toBeNull();
  });
});
