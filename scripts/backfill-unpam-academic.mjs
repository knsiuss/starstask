#!/usr/bin/env node
// Backfill academic structure for UNPAM from legacy classes data. Idempotent select-then-insert.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
function parseEnv(p) {
  const v = {};
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = l.trim();
    if (!t || t.startsWith("#")) continue;
    const e = t.indexOf("=");
    if (e < 1) continue;
    let val = t.slice(e + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    v[t.slice(0, e).trim()] = val;
  }
  return v;
}
const env = parseEnv(ENV_PATH);
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Missing Supabase env");
const apply = process.argv.includes("--apply");
const allowRemote = process.argv.includes("--allow-remote-write");
const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
if (apply && !isLocal && !allowRemote)
  throw new Error("REFUSED: production write needs --allow-remote-write");
const { createClient } = await import("file://" + SUPABASE_MODULE);
const client = createClient(url, serviceRole, {
  auth: { persistSession: false },
});
const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();
async function getOrCreate(table, filter, row) {
  const { data: ex } = await client
    .from(table)
    .select("id")
    .match(filter)
    .maybeSingle();
  if (ex) return ex.id;
  if (!apply) return null;
  const { data, error } = await client
    .from(table)
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.log("insert err", table, error.message);
    const { data: ex2 } = await client
      .from(table)
      .select("id")
      .match(filter)
      .maybeSingle();
    return ex2?.id;
  }
  return data.id;
}
const { data: uni } = await client
  .from("universities")
  .select("id,slug")
  .eq("slug", "universitas-pamulang")
  .single();
if (!uni) throw new Error("UNPAM not found");
console.log("university", uni.id);
const { data: classes } = await client
  .from("classes")
  .select(
    "id,slug,name,course_name,institution,academic_year,semester,university_id,course_id",
  )
  .eq("university_id", uni.id);
console.log("classes", classes?.length);
const { data: subjects } = await client
  .from("class_subjects")
  .select("id,class_id,name,status")
  .eq("status", "active");
const { data: courses } = await client.from("courses").select("id,name");
const courseByNorm = new Map((courses ?? []).map((c) => [norm(c.name), c]));
const institutions = [
  ...new Set(
    (classes ?? [])
      .map((c) => String(c.institution ?? "").trim())
      .filter(Boolean),
  ),
];
console.log("institutions", institutions);
let unitId = null;
for (const inst of institutions) {
  const name = inst.replace(/\b\w/g, (ch) => ch.toUpperCase());
  unitId = await getOrCreate(
    "academic_units",
    { university_id: uni.id, name },
    {
      university_id: uni.id,
      name,
      code:
        inst
          .replace(/[^A-Z0-9]/gi, "")
          .slice(0, 10)
          .toUpperCase() || null,
      unit_type: "program",
      status: "active",
    },
  );
  if (!apply) console.log("[dry] unit", name);
}
console.log("unitId", unitId);
const years = [
  ...new Set(
    (classes ?? [])
      .map((c) => String(c.academic_year ?? "").trim())
      .filter(Boolean),
  ),
];
let yearId = null;
for (const y of years) {
  const [y1, y2] = y.split("/").map(Number);
  yearId = await getOrCreate(
    "academic_years",
    { university_id: uni.id, code: y },
    {
      university_id: uni.id,
      code: y,
      name: `Tahun Ajaran ${y}`,
      start_date: `${y1 || 2024}-08-01`,
      end_date: `${y2 || 2025}-07-31`,
      status: "open",
      is_current: false,
    },
  );
  if (!apply) console.log("[dry] year", y);
}
console.log("yearId", yearId);
const sems = [
  ...new Set(
    (classes ?? []).map((c) => String(c.semester ?? "").trim()).filter(Boolean),
  ),
];
let semId = null;
for (const s of sems) {
  if (yearId || !apply)
    semId = await getOrCreate(
      "semesters",
      { university_id: uni.id, code: s, academic_year_id: yearId },
      {
        university_id: uni.id,
        academic_year_id: yearId,
        code: s,
        name: `Semester ${s}`,
        sequence_no: parseInt(s) || 1,
        status: "open",
      },
    );
  if (!apply) console.log("[dry] semester", s);
}
console.log("semId", semId);
if (apply) {
  for (const cl of classes ?? []) {
    const { error } = await client
      .from("classes")
      .update({
        academic_unit_id: unitId,
        academic_year_id: yearId,
        semester_id: semId,
      })
      .eq("id", cl.id);
    if (error) console.log("link err", error.message);
  }
  console.log("linked classes");
} else console.log("[dry] link classes");
let offeringCount = 0;
const offeringBySubject = new Map();
if (apply) {
  for (const sub of subjects ?? []) {
    const course = courseByNorm.get(norm(sub.name));
    if (!course) {
      console.log("no match", sub.name);
      continue;
    }
    const offId = await getOrCreate(
      "course_offerings",
      { university_id: uni.id, class_id: sub.class_id, course_id: course.id },
      {
        university_id: uni.id,
        class_id: sub.class_id,
        course_id: course.id,
        academic_year_id: yearId,
        semester_id: semId,
        status: "open",
      },
    );
    if (offId) {
      offeringBySubject.set(sub.id, offId);
      offeringCount++;
    }
  }
  console.log("offerings", offeringCount);
} else {
  for (const sub of subjects ?? [])
    console.log(
      "[dry] offering",
      sub.name,
      "->",
      courseByNorm.get(norm(sub.name))?.id ?? "NO MATCH",
    );
}
if (apply) {
  const { data: members } = await client
    .from("class_members")
    .select("class_id,user_id");
  const { data: memberships } = await client
    .from("university_memberships")
    .select("id,user_id")
    .eq("university_id", uni.id);
  const { data: identities } = await client
    .from("student_identities")
    .select("id,university_membership_id,university_id")
    .eq("university_id", uni.id);
  const memberById = new Map((memberships ?? []).map((m) => [m.id, m.user_id]));
  const identByUser = new Map(
    (identities ?? []).map((i) => [
      memberById.get(i.university_membership_id),
      i.id,
    ]),
  );
  let enr = 0;
  for (const sub of subjects ?? []) {
    const offId = offeringBySubject.get(sub.id);
    if (!offId) continue;
    for (const m of (members ?? []).filter(
      (m) => m.class_id === sub.class_id,
    )) {
      const ident = identByUser.get(m.user_id);
      if (!ident) continue;
      const { data: ex } = await client
        .from("enrollments")
        .select("id")
        .eq("offering_id", offId)
        .eq("student_identity_id", ident)
        .eq("status", "active")
        .maybeSingle();
      if (ex) {
        enr++;
        continue;
      }
      const { error } = await client.from("enrollments").insert({
        university_id: uni.id,
        offering_id: offId,
        student_identity_id: ident,
        source: "home_class",
        status: "active",
      });
      if (!error) enr++;
      else console.log("enroll err", error.message);
    }
  }
  console.log("enrollments", enr);
} else console.log("[dry] enrollments");
console.log(apply ? "BACKFILL APPLIED" : "DRY RUN COMPLETE");
