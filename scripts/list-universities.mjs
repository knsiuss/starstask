#!/usr/bin/env node
/**
 * Read-only listing of universities in the target registry.
 *
 * Prints only non-personal columns (short id, slug, name, status). Performs
 * no writes. Intended for the mapping review before any backfill is approved.
 */
import fs from "node:fs";
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

function main() {
  const envPath = process.env.STARSTASK_ENV_PATH ?? ENV_PATH;
  const env = parseEnv(envPath);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env in apps/web/.env.local or environment.");
  }
  return (async () => {
    const { createClient } = await import(pathToFileURL(SUPABASE_MODULE).href);
    const client = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data, error } = await client
      .from("universities")
      .select("id, slug, name, status, activated_at")
      .order("name")
      .limit(100);
    if (error) throw new Error(`Could not read universities: ${error.message}`);
    console.table(
      (data ?? []).map((row) => ({
        id: String(row.id).slice(0, 8),
        slug: row.slug,
        name: row.name,
        status: row.status,
        activated: row.activated_at ? "yes" : "no",
      })),
    );
  })();
}

await main();
