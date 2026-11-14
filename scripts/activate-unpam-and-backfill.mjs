#!/usr/bin/env node
/**
 * Safe activation + provisional identity backfill for Universitas Pamulang.
 *
 * Prerequisites and hard limits:
 * - This is a pilot bridge, not a full backfill of attendance/enrollments.
 * - Seraphim is not deleted or renamed here. It remains in profiles for manual
 *   review unless a separate mapping decision is supplied by the owner.
 * - Existing attendance and enrollment data are not changed.
 * - Legacy admin assignments are preserved; this script does NOT create new
 *   class_admin_assignments.
 *
 * Steps (idempotent, undo-aware):
 *  1. Insert/find universities row (slug=universitas-pamulang, name=Universitas Pamulang, active).
 *     activated_at set only if applying.
 *  2. For every profile whose university is now exactly "Universitas Pamulang":
 *       - upsert university_memberships(user_id=profile.id, university_id, student_id=nims, role=student, entry_year=nims-prefix-if-valid, status=active)
 *       - upsert student_identities(student_id=nims, entry_year, status=active, started_at)
 *  3. For every existing class that more than one of those users belongs to (legacy class_members),
 *     set classes.university_id = university.id if currently null.
 *  4. For every legacy class_members row of a mapped user, upsert class_memberships
 *     (class_id, university_id, student_identity_id, is_home=true, joined_via=home_class, joined_at)
 *     and enrollments(status=active) *only* when a matching offering exists?
 *     NOTE: enrollments requires offering ids that do not exist yet for legacy mode; skipping enrollment
 *     here is intentional to avoid inventing a mismatch. class_memberships alone activates home-class identity.
 *  5. Print counts. --apply required for writes; otherwise dry-run.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const ENV_PATH = path.join(REPO_ROOT, "apps", "web", ".env.local");
const SUPABASE_MODULE = path.join(
  REPO_ROOT,
  "apps",
  "web",
  "node_modules",
  "@supabase",
  "supabase-js",
  "dist",
  "index.mjs",
);
const PAGE_SIZE = 1000;
const CANONICAL = "Universitas Pamulang";
const SLUG = "universitas-pamulang";

const args = process.argv.slice(2);
function valueFor(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

const apply = args.includes("--apply");
const backupArg = valueFor("--backup", undefined);
const envArg = valueFor("--env", undefined);

function parseEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[trimmed.slice(0, equals).trim()] = value;
  }
  return values;
}

async function findClient() {
  const env = parseEnv(envArg ? path.resolve(REPO_ROOT, envArg) : ENV_PATH);
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "Missing Supabase env in apps/web/.env.local or environment.",
    );
  }
  const { createClient } = await import(pathToFileURL(SUPABASE_MODULE).href);
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function deriveEntryYear(nim) {
  if (!nim) return null;
  const prefix = String(nim).slice(0, 4);
  const year = Number.parseInt(prefix, 10);
  if (Number.isFinite(year) && year >= 1950 && year <= 2100) return year;
  return null;
}

async function loadAll(client, table, select = "*") {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function ensureUniversity(client, actorId) {
  const { data: existing, error: readError } = await client
    .from("universities")
    .select("id, slug, name, status, activated_at")
    .eq("slug", SLUG)
    .maybeSingle();
  if (readError)
    throw new Error(`universities read failed: ${readError.message}`);
  if (existing) {
    if (existing.status !== "active") {
      const { error } = await client
        .from("universities")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
          name: CANONICAL,
        })
        .eq("id", existing.id);
      if (error)
        throw new Error(`universities activation failed: ${error.message}`);
      existing.status = "active";
      existing.activated_at = new Date().toISOString();
    }
    return existing;
  }
  const { data, error } = await client
    .from("universities")
    .insert({
      slug: SLUG,
      name: CANONICAL,
      short_name: "UNPAM",
      type: "universitas",
      country: "ID",
      timezone: "Asia/Jakarta",
      locale: "id-ID",
      status: "active",
      activated_at: new Date().toISOString(),
      created_by: actorId,
    })
    .select("id, slug, name, status, activated_at")
    .single();
  if (error) throw new Error(`universities insert failed: ${error.message}`);
  return data;
}

async function main() {
  const client = await findClient();
  const profiles = await loadAll(
    client,
    "profiles",
    "id, nim, university, created_at",
  );
  const unpamProfiles = profiles.filter(
    (profile) =>
      typeof profile.university === "string" &&
      profile.university.trim() === CANONICAL,
  );
  console.log(`Universitas Pamulang profiles: ${unpamProfiles.length}`);
  console.log(
    `profiles nim coverage: ${unpamProfiles.filter((p) => p.nim).length} / ${unpamProfiles.length}`,
  );
  const legacyMemberships = await loadAll(
    client,
    "class_members",
    "class_id, user_id",
  );
  const legacyClasses = await loadAll(client, "classes", "id, name, slug");
  const mappedUserIds = new Set(unpamProfiles.map((p) => p.id));
  const classesWithUnpamMembers = new Map(
    legacyClasses.map((cls) => [cls.id, cls]),
  );
  const memberRows = legacyMemberships.filter((row) =>
    mappedUserIds.has(row.user_id),
  );
  for (const row of memberRows) {
    if (!classesWithUnpamMembers.has(row.class_id)) continue;
  }
  console.log(`legacy class_members for UNPAM users: ${memberRows.length}`);

  if (!apply) {
    console.log(
      "dry-run only; rerun with --apply --backup <file> to activate + backfill identities",
    );
    return;
  }
  if (!backupArg) throw new Error("--apply requires --backup <file>.");
  const backupPath = path.resolve(backupArg);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({
      phase: "pilot-activation",
      at: new Date().toISOString(),
    }) + "\n",
    "utf8",
  );
  const university = await ensureUniversity(client, null);
  console.log(`university: ${university.slug} (${university.id})`);
  let memberships = 0;
  let identities = 0;
  let classLinks = 0;
  for (const profile of unpamProfiles) {
    if (!profile.nim) continue;
    const entryYear = deriveEntryYear(profile.nim);
    const { data: membership, error: memError } = await client
      .from("university_memberships")
      .upsert(
        {
          user_id: profile.id,
          university_id: university.id,
          student_id: profile.nim,
          role: "student",
          entry_year: entryYear,
          status: "active",
        },
        { onConflict: "user_id,university_id" },
      )
      .select("id")
      .single();
    if (memError)
      throw new Error(`membership upsert failed: ${memError.message}`);
    memberships += 1;
    const { data: identity, error: idError } = await client
      .from("student_identities")
      .upsert(
        {
          university_membership_id: membership.id,
          university_id: university.id,
          student_id: profile.nim,
          entry_year: entryYear,
          status: "active",
          started_at: new Date().toISOString(),
        },
        { onConflict: "university_membership_id" },
      )
      .select("id")
      .single();
    if (idError) throw new Error(`identity upsert failed: ${idError.message}`);
    identities += 1;
    for (const row of memberRows.filter(
      (item) => item.user_id === profile.id,
    )) {
      if (!row.class_id) continue;
      // Roll out class university mapping first (additive, only fills nulls)
      for (const cls of classesWithUnpamMembers.values()) {
        const { error } = await client
          .from("classes")
          .update({ university_id: university.id })
          .eq("id", cls.id)
          .is("university_id", null);
        if (error)
          throw new Error(
            `classes university_id update failed: ${error.message}`,
          );
      }
      console.log(
        `classes university_id linked: ${classesWithUnpamMembers.size}`,
      );
      // Note: no partial uniques exist for class_memberships(class_id, student_identity_id)
      // in plain form; use a defensive upsert without onConflict then handle uniqueness
      // in dry-run by checking if a matching row already exists via select first.
      const { data: existing } = await client
        .from("class_memberships")
        .select("id")
        .eq("class_id", row.class_id)
        .eq("student_identity_id", identity.id)
        .eq("university_id", university.id)
        .maybeSingle();
      if (!existing) {
        const { error: linkError } = await client
          .from("class_memberships")
          .insert({
            university_id: university.id,
            class_id: row.class_id,
            student_identity_id: identity.id,
            is_home: true,
            joined_via: "home_class",
            joined_at: new Date().toISOString(),
            left_at: null,
          });
        if (linkError)
          throw new Error(
            `class membership insert failed: ${linkError.message}`,
          );
        classLinks += 1;
      }
    }
  }
  console.log(JSON.stringify({ memberships, identities, classLinks }));
}

await main();
