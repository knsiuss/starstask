#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
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
const CANONICAL = "Universitas Pamulang";

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const values = {};
for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  values[t.slice(0, i).trim()] = v;
}

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? values.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? values.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = await import(pathToFileURL(SUPABASE_MODULE).href);
const client = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await client
  .from("profiles")
  .select("id, university")
  .limit(1000);
if (error) throw new Error(`read failed: ${error.message}`);
const target = (data ?? []).find(
  (row) =>
    typeof row.university === "string" &&
    normalize(row.university) !== "seraphim" &&
    ["universitas pamulang", "pamulang university", "unpam"].includes(
      normalize(row.university),
    ),
);
if (!target) {
  console.log("no row needs update");
  process.exit(0);
}
const before = target.university;
const { data: updated, error: updateError } = await client
  .from("profiles")
  .update({ university: CANONICAL })
  .eq("id", target.id)
  .select("university");
console.log("update_error=" + (updateError ? updateError.message : "none"));
console.log("updated_fields=" + (updated?.[0]?.university ?? "unknown"));
console.log("row_would_change=" + (before === CANONICAL ? "no" : "yes"));
