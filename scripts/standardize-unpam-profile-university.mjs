#!/usr/bin/env node
/**
 * Idempotent standardizer for the UNPAM free-text university field.
 *
 * Scope (hard-coded):
 *   - "Universitas Pamulang" and harmless casing variants
 *   - "Pamulang University"
 *   - "Unpam"
 *
 * Anything else (notably "Seraphim") is never changed.
 * Dry-run is the default. `--apply` requires `--backup <file>` and performs:
 *   1. exact preflight counts, 2. local backup of ids/old values,
 *   3. updates, 4. post-update verification, 5. rollback on failure.
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
const TARGETS = new Set([
  "universitas pamulang",
  "pamulang university",
  "unpam",
]);

const args = process.argv.slice(2);
function valueFor(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

const apply = args.includes("--apply");
const backupArg = valueFor("--backup", undefined);
const envArg = valueFor("--env", undefined);

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

async function loadTargets(client, { exactOnly = false } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("profiles")
      .select("id, university")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`profiles read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (typeof row.university !== "string") continue;
      const isTarget = TARGETS.has(normalize(row.university));
      const needsUpdate = exactOnly
        ? isTarget && row.university !== CANONICAL
        : isTarget;
      if (needsUpdate) rows.push({ id: row.id, university: row.university });
    }
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function summarize(client) {
  const targets = await loadTargets(client, { exactOnly: true });
  const variants = new Map();
  for (const row of targets) {
    variants.set(row.university, (variants.get(row.university) ?? 0) + 1);
  }
  console.log(`matching rows: ${targets.length}`);
  for (const [variant, count] of [...variants.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${String(count).padStart(4)} | ${variant}`);
  }
  return targets;
}

async function restoreBackup(client, rows) {
  for (const row of rows) {
    const { error } = await client
      .from("profiles")
      .update({ university: row.university })
      .eq("id", row.id);
    if (error) throw new Error(`rollback failed for one row: ${error.message}`);
  }
}

async function main() {
  const client = await findClient();
  if (!apply) {
    await summarize(client);
    console.log(
      "dry-run only; rerun with --apply --backup <file> to standardize",
    );
    return;
  }

  if (!backupArg) throw new Error("--apply requires --backup <file>.");

  const backupPath = path.resolve(backupArg);
  const rows = await loadTargets(client, { exactOnly: true });
  if (rows.length === 0) {
    console.log("matching rows: 0 (already standardized)");
    return;
  }
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      { rows, reason: "unpam-university-standardization" },
      null,
      2,
    ),
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
  console.log(`backup written: ${backupPath}`);
  console.log(`rows to update: ${rows.length}`);

  const updated = [];
  try {
    for (const row of rows) {
      const { error } = await client
        .from("profiles")
        .update({ university: CANONICAL })
        .eq("id", row.id);
      if (error) throw error;
      updated.push(row);
    }
    const remaining = await loadTargets(client, { exactOnly: true });
    if (remaining.length > 0)
      throw new Error(`post-check left ${remaining.length} matching row(s)`);
    console.log(`updated ${updated.length} row(s) to ${CANONICAL}`);
  } catch (error) {
    await restoreBackup(client, updated);
    throw new Error(
      `failed; rolled back ${updated.length} row(s): ${error.message ?? error}`,
    );
  }
}

await main();
