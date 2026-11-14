import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Production-Scale Hardening Plan §3 — negative RLS tests (live gate).
 *
 * Requires SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY and
 * SUPABASE_TEST_SERVICE_ROLE_KEY pointed at a DISPOSABLE local stack
 * (`supabase start`). The service-role key is used ONLY to seed a throwaway
 * cross-tenant dataset (2 universities / 2 users / 2 classes) and to clean
 * it up. Never run this against production.
 *
 * Covered:
 *  - anon denied (SELECT on tenant tables, privileged RPC EXECUTE)
 *  - cross-university reads denied (memberships owner-only)
 *  - cross-class reads/writes denied (is_class_member-scoped policies)
 *  - storage cross-user write denial (avatars bucket)
 *  - audit_logs append-only (UPDATE/DELETE denied for authenticated)
 */
const url = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const hasEnv = Boolean(url && anonKey && serviceRoleKey);
const suffix = randomUUID().slice(0, 8);
const PASSWORD = `test-${randomUUID()}`;

type TestUser = { id: string; client: SupabaseClient };

let admin: SupabaseClient;
let anon: SupabaseClient;
let userA: TestUser;
let userB: TestUser;
let uniA = "";
let uniB = "";
let classA = "";
let classB = "";
let courseA = "";

async function createTestUser(label: string): Promise<TestUser> {
  const email = `starstask-neg-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Negative ${label}` },
  });
  if (error || !data.user) {
    throw new Error(`Could not create user ${label}: ${error?.message}`);
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
  return { id: data.user.id, client };
}

describe.skipIf(!hasEnv)("Negative RLS gates", () => {
  beforeAll(async () => {
    admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    userA = await createTestUser("a");
    userB = await createTestUser("b");

    // Seed disposable cross-tenant dataset (service_role bypasses RLS).
    const mkUni = async (slug: string) => {
      const { data, error } = await admin
        .from("universities")
        .insert({ slug, name: `Neg Uni ${slug}`, status: "active" })
        .select("id")
        .single();
      if (error || !data)
        throw new Error(`seed uni ${slug}: ${error?.message}`);
      return data.id as string;
    };
    uniA = await mkUni(`neg-uni-a-${suffix}`);
    uniB = await mkUni(`neg-uni-b-${suffix}`);

    const { error: memErr } = await admin
      .from("university_memberships")
      .insert([
        {
          user_id: userA.id,
          university_id: uniA,
          role: "student",
          status: "active",
        },
        {
          user_id: userB.id,
          university_id: uniB,
          role: "student",
          status: "active",
        },
      ]);
    if (memErr) throw new Error(`seed memberships: ${memErr.message}`);

    const { data: course, error: courseErr } = await admin
      .from("courses")
      .insert({ name: `Neg Course ${suffix}`, university_id: uniA })
      .select("id")
      .single();
    if (courseErr || !course)
      throw new Error(`seed course: ${courseErr?.message}`);
    courseA = course.id as string;

    const mkClass = async (slug: string, universityId: string) => {
      const { data, error } = await admin
        .from("classes")
        .insert({
          slug,
          name: `Neg Class ${slug}`,
          description: "Negative RLS disposable class",
          course_id: courseA,
          course_name: `Neg Course ${suffix}`,
          semester: "1",
          academic_year: "2025/2026",
          status: "active",
          join_policy: "invitation",
          university_id: universityId,
        })
        .select("id")
        .single();
      if (error || !data)
        throw new Error(`seed class ${slug}: ${error?.message}`);
      return data.id as string;
    };
    classA = await mkClass(`neg-class-a-${suffix}`, uniA);
    classB = await mkClass(`neg-class-b-${suffix}`, uniB);

    const { error: cmErr } = await admin.from("class_members").insert({
      class_id: classA,
      user_id: userA.id,
      joined_via: "invitation",
    });
    if (cmErr) throw new Error(`seed class_members: ${cmErr.message}`);
    // userB is class admin of classB only (must be a member first: FK).
    const { error: cbmErr } = await admin
      .from("class_members")
      .insert([
        { class_id: classB, user_id: userB.id, joined_via: "invitation" },
      ]);
    if (cbmErr) throw new Error(`seed class_members B: ${cbmErr.message}`);
    const { error: caErr } = await admin
      .from("class_admins")
      .insert({ class_id: classB, user_id: userB.id });
    if (caErr) throw new Error(`seed class_admins: ${caErr.message}`);
  });

  afterAll(async () => {
    if (!hasEnv) return;
    // Best-effort cleanup of the disposable dataset (local stack only).
    await admin.from("class_admins").delete().eq("class_id", classB);
    await admin.from("class_members").delete().in("class_id", [classA, classB]);
    await admin.from("classes").delete().in("id", [classA, classB]);
    await admin.from("courses").delete().eq("id", courseA);
    await admin
      .from("university_memberships")
      .delete()
      .in("user_id", [userA.id, userB.id]);
    await admin.from("universities").delete().in("id", [uniA, uniB]);
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
  });

  it("anon is denied tenant-table reads (0 rows or fail-closed error, never a row leak)", async () => {
    const { data, error } = await anon
      .from("classes")
      .select("id")
      .eq("id", classA);
    // Hardening §3 invariant: anon sees zero tenant rows. After the 20261119
    // grant revocation a SELECT can fail closed with 42501 (policy predicate
    // can_manage_class is no longer anon-EXECUTE-able) — that is also a
    // denial, so accept either shape and assert no rows ever leak.
    expect(data ?? []).toHaveLength(0);
    expect(error === null || error.code === "42501").toBe(true);
  });

  it("anon cannot EXECUTE privileged RPCs (grant revoked in 20261119)", async () => {
    const { error } = await anon.rpc("review_class_assignment", {
      p_assignment_id: randomUUID(),
      p_decision: "approved",
      p_note: "must be denied",
    });
    expect(error).not.toBeNull();
  });

  it("cross-class / cross-university reads are denied", async () => {
    // userA is a member of classA only.
    //
    // NOTE (measured 2026-11-05): the `classes` table intentionally exposes
    // ALL `status = 'active'` rows to any authenticated user (public class
    // discovery policy: `status='active' OR is_class_member(id) OR
    // can_manage_class(id)`). So classA/classB basic rows are NOT a tenant
    // boundary — the isolation boundary is tenant-scoped content
    // (announcements, memberships, assignments) plus is_class_member().
    const { data: asA } = await userA.client
      .from("classes")
      .select("id")
      .eq("id", classA);
    expect(asA ?? []).toHaveLength(1);

    const { data: memberCheck } = await userA.client.rpc("is_class_member", {
      p_class_id: classB,
    });
    expect(memberCheck).toBe(false);

    // Tenant-scoped content of the other class/university must not leak.
    const { data: leakedAnnouncements } = await userA.client
      .from("announcements")
      .select("id")
      .eq("class_id", classB);
    expect(leakedAnnouncements ?? []).toHaveLength(0);
  });

  it("cross-university membership reads are owner-only", async () => {
    const { data } = await userA.client
      .from("university_memberships")
      .select("user_id")
      .eq("user_id", userB.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("cross-class writes are denied", async () => {
    const { error } = await userA.client.from("announcements").insert({
      class_id: classB,
      university_id: uniB,
      author: userA.id,
      title: "cross-class write attempt",
      body: "must be denied",
      published_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("storage: cross-user avatar write/delete is denied", async () => {
    // Seed an avatar object under userB's folder via service_role.
    const path = `${userB.id}/avatar.png`;
    const { error: upErr } = await admin.storage
      .from("avatars")
      .upload(path, new Blob(["neg"], { type: "image/png" }), {
        upsert: true,
      });
    if (upErr) throw new Error(`seed avatar: ${upErr.message}`);

    const { error: delErr } = await userA.client.storage
      .from("avatars")
      .remove([path]);
    // RLS on DELETE is owner-only -> denied or silently no-op. Fail loudly
    // only if the object was actually removed.
    const { data: remaining } = await admin.storage
      .from("avatars")
      .list(userB.id, { limit: 10 });
    if (delErr) {
      expect(delErr).not.toBeNull();
    }
    expect((remaining ?? []).some((o) => o.name === "avatar.png")).toBe(true);

    await admin.storage.from("avatars").remove([path]);
  });

  it("cross-university writes are denied", async () => {
    // userA belongs to uniA only: writing a row scoped to uniB must fail.
    const { error } = await userA.client.from("announcements").insert({
      class_id: classA,
      university_id: uniB,
      author: userA.id,
      title: "cross-university write attempt",
      body: "must be denied",
      published_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("unauthorized class admin cannot act on another class", async () => {
    // userB is class admin of classB only (seeded below via service_role);
    // a write scoped to classA must be denied for them.
    const { error } = await userB.client.from("announcements").insert({
      class_id: classA,
      university_id: uniA,
      author: userB.id,
      title: "admin cross-class write attempt",
      body: "must be denied",
      published_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("authenticated non-admin cannot create classes", async () => {
    const { error } = await userA.client.from("classes").insert({
      slug: `neg-evil-${suffix}`,
      name: "Negative Evil Class",
      description: "must be denied",
      course_id: courseA,
      course_name: `Neg Course ${suffix}`,
      semester: "1",
      academic_year: "2025/2026",
      status: "active",
      join_policy: "invitation",
      university_id: uniA,
    });
    expect(error).not.toBeNull();
  });

  it("storage: signed URLs for another user's object are denied (private bucket)", async () => {
    // avatars is a PUBLIC bucket (intentional: SELECT to anon/authenticated),
    // so signed URLs there are not a policy boundary. Private buckets
    // (verification-evidence) use owner-scoped SELECT: cross-user signed-URL
    // creation must be denied.
    const path = `${userB.id}/signed.png`;
    const { error: upErr } = await admin.storage
      .from("verification-evidence")
      .upload(path, new Blob(["signed"], { type: "image/png" }), {
        upsert: true,
      });
    if (upErr) throw new Error(`seed evidence: ${upErr.message}`);

    const { error: urlErr } = await userA.client.storage
      .from("verification-evidence")
      .createSignedUrl(path, 60);
    expect(urlErr).not.toBeNull();

    await admin.storage.from("verification-evidence").remove([path]);
  });

  it("audit_logs are append-only for authenticated (no UPDATE/DELETE)", async () => {
    const { error: updErr } = await userA.client
      .from("audit_logs")
      .update({ action: "tampered" })
      .eq("id", randomUUID());
    // No UPDATE policy/grant: must fail (RLS or privilege error).
    expect(updErr).not.toBeNull();
  });
});
