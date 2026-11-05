#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const values = {};
for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? values.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? values.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing env.");

const { createClient } = await import(pathToFileURL(SUPABASE_MODULE).href);
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client
  .from("profiles")
  .select("id, university")
  .limit(1);
console.log("read_error=" + (error ? error.message : "none"));
console.log("keys=" + Object.keys(data?.[0] ?? {}).join(","));
console.log("row_present=" + (data?.length ?? 0));
