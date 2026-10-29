import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Database authorization tests against a real Supabase project.
 *
 * Requires SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, and
 * SUPABASE_TEST_SERVICE_ROLE_KEY (never used by the app). Point these at a
 * disposable local project created with `supabase start`; the suite creates
 * and deletes its own users.
 */
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const hasEnv = Boolean(url && anonKey && serviceRoleKey);
const PASSWORD = `test-${crypto.randomUUID()}`;
const suffix = Date.now().toString(36);

type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

let admin: SupabaseClient;
let anon: SupabaseClient;
let userA: TestUser;
let userB: TestUser;
let courseId: string;
let publishedId: string;
let pendingId: string;

const PUSH_ENDPOINT = `https://push.example.test/send/${suffix}`;
const PUSH_P256DH = "B".repeat(40);
const PUSH_AUTH = "A".repeat(16);

async function createTestUser(label: string): Promise<TestUser> {
  const email = `starstask-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label.toUpperCase()}` },
  });

  if (error || !data.user) {
    throw new Error(`Could not create test user ${label}: ${error?.message}`);
  }

  const client = createClient(url!, anonKey!, {
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

describe.skipIf(!hasEnv)("RLS and ownership boundaries", () => {
  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    userA = await createTestUser("a");
    userB = await createTestUser("b");

    const { data: course, error: courseError } = await userA.client.rpc(
      "create_or_get_course",
      { p_name: `RLS Test Course ${suffix}`, p_code: "TST101" },
    );

    if (courseError || !course) {
      throw new Error(`Could not create test course: ${courseError?.message}`);
    }

    courseId = course.id;

    const base = {
      description:
        "A description long enough for the database check constraint.",
      course_id: courseId,
      user_id: userA.id,
    };

    const { data: published, error: publishedError } = await userA.client
      .from("assignments")
      .insert({ ...base, title: "Published assignment" })
      .select("id")
      .single();

    if (publishedError || !published) {
      throw new Error(
        `Could not insert published assignment: ${publishedError?.message}`,
      );
    }

    publishedId = published.id;

    const { data: pending, error: pendingError } = await userA.client
      .from("assignments")
      .insert({ ...base, title: "Pending assignment" })
      .select("id")
      .single();

    if (pendingError || !pending) {
      throw new Error(
        `Could not insert pending assignment: ${pendingError?.message}`,
      );
    }

    pendingId = pending.id;

    // Clients cannot set status (column not granted), so flip it with the
    // service role to model a moderation queue.
    const { error: statusError } = await admin
      .from("assignments")
      .update({ status: "pending" })
      .eq("id", pendingId);

    if (statusError) {
      throw new Error(`Could not set pending status: ${statusError.message}`);
    }
  });

  afterAll(async () => {
    // Deleting the users cascades to their assignments; only then can the
    // course be removed (assignments.course_id is ON DELETE RESTRICT).
    for (const user of [userA, userB]) {
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }

    if (admin && courseId) {
      await admin.from("courses").delete().eq("id", courseId);
    }
  });

  it("provisions a profile automatically for each new auth user", async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", [userA.id, userB.id]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.find((row) => row.id === userA.id)?.display_name).toContain(
      "A",
    );
  });

  it("is idempotent when profile provisioning runs twice", async () => {
    const { data: before } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userA.id);

    await admin
      .from("profiles")
      .upsert(
        { id: userA.id, display_name: "Still here" },
        { onConflict: "id" },
      );

    const { data: after } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userA.id);

    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
  });

  it("lets anonymous visitors read published assignments", async () => {
    const { data, error } = await anon
      .from("assignments")
      .select("id")
      .eq("id", publishedId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("hides pending assignments from anonymous visitors", async () => {
    const { data, error } = await anon
      .from("assignments")
      .select("id")
      .eq("id", pendingId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("lets the owner read their own pending assignment", async () => {
    const { data, error } = await userA.client
      .from("assignments")
      .select("id")
      .eq("id", pendingId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("rejects an anonymous insert", async () => {
    const { error } = await anon.from("assignments").insert({
      title: "Anonymous write",
      description: "This must never be stored by an anonymous visitor.",
      course_id: courseId,
      user_id: userA.id,
    });

    expect(error).not.toBeNull();
  });

  it("rejects inserting an assignment for another user", async () => {
    const { error } = await userB.client.from("assignments").insert({
      title: "Spoofed owner",
      description: "This insert claims to belong to a different user.",
      course_id: courseId,
      user_id: userA.id,
    });

    expect(error).not.toBeNull();
  });

  it("rejects updating another user's assignment", async () => {
    const { data, error } = await userB.client
      .from("assignments")
      .update({ title: "Hijacked" })
      .eq("id", publishedId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("rejects deleting another user's assignment", async () => {
    const { data, error } = await userB.client
      .from("assignments")
      .delete()
      .eq("id", publishedId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: stillThere } = await admin
      .from("assignments")
      .select("id")
      .eq("id", publishedId);
    expect(stillThere).toHaveLength(1);
  });

  it("lets the owner update their own assignment", async () => {
    const { data, error } = await userA.client
      .from("assignments")
      .update({ title: "Published assignment (edited)" })
      .eq("id", publishedId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("blocks ownership transfer even for the owner", async () => {
    const { error } = await userA.client
      .from("assignments")
      .update({ user_id: userB.id })
      .eq("id", publishedId);

    // The column is not granted for update, so PostgREST rejects the request.
    expect(error).not.toBeNull();

    const { data } = await admin
      .from("assignments")
      .select("user_id")
      .eq("id", publishedId)
      .single();
    expect(data?.user_id).toBe(userA.id);
  });

  it("rejects an attachment record outside the owner's storage prefix", async () => {
    const { error } = await userB.client.from("assignment_attachments").insert({
      assignment_id: publishedId,
      storage_path: `${userA.id}/${publishedId}/stolen.pdf`,
      original_filename: "stolen.pdf",
      mime_type: "application/pdf",
      file_size: 1024,
    });

    expect(error).not.toBeNull();
  });

  it("rejects a storage upload into another user's assignment folder", async () => {
    const { error } = await userB.client.storage
      .from("assignment-attachments")
      .upload(
        `${userA.id}/${publishedId}/intruder.pdf`,
        new Uint8Array([1, 2, 3]),
        {
          contentType: "application/pdf",
          upsert: false,
        },
      );

    expect(error).not.toBeNull();
  });

  it("prevents a user from editing another user's profile", async () => {
    const { data, error } = await userB.client
      .from("profiles")
      .update({ display_name: "Impersonated" })
      .eq("id", userA.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  describe("push notification boundaries", () => {
    let subscriptionId = "";

    beforeAll(async () => {
      const { data, error } = await userA.client.rpc(
        "register_push_subscription",
        {
          p_endpoint: PUSH_ENDPOINT,
          p_p256dh: PUSH_P256DH,
          p_auth: PUSH_AUTH,
          p_device_label: "Test browser",
        },
      );

      if (error || !data) {
        throw new Error(
          `Could not register test subscription: ${error?.message}`,
        );
      }

      subscriptionId = data;
    });

    it("registers a device for the caller", async () => {
      const { data, error } = await userA.client
        .from("push_subscriptions")
        .select("id, device_label")
        .eq("id", subscriptionId);

      expect(error).toBeNull();
      expect(data).toEqual([
        { id: subscriptionId, device_label: "Test browser" },
      ]);
    });

    it("never exposes the endpoint or key material to the browser", async () => {
      const { error } = await userA.client
        .from("push_subscriptions")
        .select("endpoint")
        .eq("id", subscriptionId);

      expect(error).not.toBeNull();
    });

    it("hides another user's subscription", async () => {
      const { data, error } = await userB.client
        .from("push_subscriptions")
        .select("id")
        .eq("id", subscriptionId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("refuses to transfer an endpoint to another account", async () => {
      const { data, error } = await userB.client.rpc(
        "register_push_subscription",
        {
          p_endpoint: PUSH_ENDPOINT,
          p_p256dh: PUSH_P256DH,
          p_auth: PUSH_AUTH,
          p_device_label: "Other browser",
        },
      );

      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("rejects an anonymous registration", async () => {
      const { error } = await anon.rpc("register_push_subscription", {
        p_endpoint: `https://push.example.test/send/${suffix}-anon`,
        p_p256dh: PUSH_P256DH,
        p_auth: PUSH_AUTH,
      });

      expect(error).not.toBeNull();
    });

    it("rejects inserting a subscription for another user", async () => {
      const { error } = await userB.client.from("push_subscriptions").insert({
        user_id: userA.id,
        endpoint: `https://push.example.test/send/${suffix}-spoof`,
        p256dh: PUSH_P256DH,
        auth: PUSH_AUTH,
      });

      expect(error).not.toBeNull();
    });

    it("lets a user manage only their own preferences", async () => {
      // Mirrors `updateNotificationPreferences`: the first write inserts, later
      // writes update, so `user_id` never appears in an UPDATE statement.
      const { error: insertError } = await userA.client
        .from("notification_preferences")
        .insert({
          user_id: userA.id,
          push_enabled: true,
          timezone: "Asia/Makassar",
        });

      expect(insertError).toBeNull();

      const { error: updateError } = await userA.client
        .from("notification_preferences")
        .update({ push_enabled: false, timezone: "Asia/Makassar" })
        .eq("user_id", userA.id);

      expect(updateError).toBeNull();

      const { data: own } = await userA.client
        .from("notification_preferences")
        .select("push_enabled, timezone")
        .eq("user_id", userA.id);

      expect(own).toEqual([{ push_enabled: false, timezone: "Asia/Makassar" }]);

      const { data: other } = await userB.client
        .from("notification_preferences")
        .select("push_enabled")
        .eq("user_id", userA.id);

      expect(other).toEqual([]);
    });

    it("refuses to reassign a preference row to another user", async () => {
      const { error } = await userA.client
        .from("notification_preferences")
        .update({ user_id: userB.id })
        .eq("user_id", userA.id);

      expect(error).not.toBeNull();
    });

    it("rejects a preference row for another user", async () => {
      const { error } = await userB.client
        .from("notification_preferences")
        .insert({ user_id: userA.id, push_enabled: true });

      expect(error).not.toBeNull();
    });

    it("lets a user save a visible assignment but not read another user's saves", async () => {
      const { error } = await userA.client
        .from("saved_assignments")
        .insert({ user_id: userA.id, assignment_id: publishedId });

      expect(error).toBeNull();

      const { data: other } = await userB.client
        .from("saved_assignments")
        .select("assignment_id")
        .eq("assignment_id", publishedId);

      expect(other).toEqual([]);
    });

    it("rejects saving an assignment the user cannot see", async () => {
      const { error } = await userB.client
        .from("saved_assignments")
        .insert({ user_id: userB.id, assignment_id: pendingId });

      expect(error).not.toBeNull();
    });

    it("rejects a save for another user", async () => {
      const { error } = await userB.client
        .from("saved_assignments")
        .insert({ user_id: userA.id, assignment_id: publishedId });

      expect(error).not.toBeNull();
    });

    it("lets a user read only their own delivery history", async () => {
      const { data: inserted, error: insertError } = await admin
        .from("notification_deliveries")
        .insert({
          user_id: userA.id,
          assignment_id: publishedId,
          reminder_type: "24h",
          deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          scheduled_for: new Date().toISOString(),
          status: "sent",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();

      const { data: own } = await userA.client
        .from("notification_deliveries")
        .select("id, status")
        .eq("id", inserted?.id);

      expect(own).toEqual([{ id: inserted?.id, status: "sent" }]);

      const { data: other } = await userB.client
        .from("notification_deliveries")
        .select("id")
        .eq("id", inserted?.id);

      expect(other).toEqual([]);
    });

    it("does not let a client create or mutate a delivery", async () => {
      const { error: insertError } = await userA.client
        .from("notification_deliveries")
        .insert({
          user_id: userA.id,
          assignment_id: publishedId,
          reminder_type: "3h",
          deadline_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
        });

      expect(insertError).not.toBeNull();

      const { error: updateError } = await userA.client
        .from("notification_deliveries")
        .update({ status: "sent" })
        .eq("user_id", userA.id);

      expect(updateError).not.toBeNull();
    });

    it("does not let a client claim or complete deliveries", async () => {
      const { error: claimError } = await userA.client.rpc(
        "claim_notification_deliveries",
        { p_now: new Date().toISOString(), p_limit: 1 },
      );

      expect(claimError).not.toBeNull();

      const { error: completeError } = await userA.client.rpc(
        "complete_notification_delivery",
        { p_id: crypto.randomUUID(), p_status: "sent" },
      );

      expect(completeError).not.toBeNull();
    });

    it("removes a subscription only for its owner", async () => {
      const { data: deletedByOther } = await userB.client
        .from("push_subscriptions")
        .delete()
        .eq("id", subscriptionId)
        .select("id");

      expect(deletedByOther).toEqual([]);

      const { data: deletedByOwner, error } = await userA.client
        .from("push_subscriptions")
        .delete()
        .eq("id", subscriptionId)
        .select("id");

      expect(error).toBeNull();
      expect(deletedByOwner).toEqual([{ id: subscriptionId }]);
    });
  });
});
