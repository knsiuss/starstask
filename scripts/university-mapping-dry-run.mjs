#!/usr/bin/env node
/**
 * Read-only dry-run for legacy university-name mapping.
 *
 * It never writes to a database. It aggregates only the free-text `profiles.university`
 * values so a human can review candidates before any membership backfill is approved.
 *
 * Usage:
 *   node scripts/university-mapping-dry-run.mjs --help
 *   node scripts/university-mapping-dry-run.mjs --env apps/web/.env.local --local
 *   node scripts/university-mapping-dry-run.mjs --env apps/web/.env.local --allow-remote-read --out university-mapping.csv
 *   node scripts/university-mapping-dry-run.mjs --self-test
 *
 * Local/staging only by default. Remote/production reads require --allow-remote-read.
 * The script prints counts only; it does not print user IDs, names, or emails.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const DEFAULT_ENV = path.join(REPO_ROOT, "apps", "web", ".env.local");
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

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const help = args.includes("--help") || args.includes("-h");
const localOnly = args.includes("--local");
const allowRemoteRead = args.includes("--allow-remote-read");
function valueFor(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

const outArg = valueFor("--out", "university-mapping-dry-run.csv");
const envArg = valueFor("--env", DEFAULT_ENV);
const mapArg = valueFor("--map", undefined);
const outPath = path.resolve(REPO_ROOT, outArg);
const envPath = path.resolve(REPO_ROOT, envArg);

if (help) {
  console.log(
    "No writes are performed. Use --self-test for a no-DB check.\n" +
      "For a read-only scan pass --local (localhost DB) or --allow-remote-read. A map CSV may contain columns variant,university_slug.",
  );
  process.exit(0);
}

function parseEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function normalize(raw) {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aggregate(rows) {
  const byRaw = new Map();
  const byNorm = new Map();
  for (const value of rows) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    byRaw.set(trimmed, (byRaw.get(trimmed) ?? 0) + 1);
    const normalized = normalize(trimmed);
    const bucket = byNorm.get(normalized) ?? { count: 0, variants: new Set() };
    bucket.count += 1;
    bucket.variants.add(trimmed);
    byNorm.set(normalized, bucket);
  }
  return { byRaw, byNorm };
}

function escapeCsv(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function printCounts(byNorm, source) {
  console.log(`-- ${source} (${byNorm.size} normalized variants) --`);
  const sorted = [...byNorm.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [normalized, { count, variants }] of sorted) {
    console.log(`${String(count).padStart(5)} | ${normalized}`);
  }
}

async function readProfiles() {
  const { createClient } = await import(pathToFileURL(SUPABASE_MODULE).href);
  const env = parseEnv(envPath);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${path.relative(REPO_ROOT, envPath)} (or environment).`,
    );
  }
  const host = new URL(url).hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal && !allowRemoteRead) {
    throw new Error(
      `Refusing remote read from ${host}; rerun with --allow-remote-read only after confirming this is staging/local. No query was sent.`,
    );
  }
  const client = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("profiles")
      .select("university")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`profiles read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data.map((row) => row.university));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function main() {
  if (selfTest) {
    const sample = [
      "Universitas X",
      "univ. x",
      "Universitas X",
      "Other Uni",
      "",
      null,
    ];
    const { byNorm } = aggregate(sample);
    if (byNorm.get("universitas x")?.count !== 2) {
      throw new Error("self-test failed");
    }
    console.log("self-test passed");
    return;
  }
  if (!localOnly && !allowRemoteRead) {
    console.error(
      "Refusing implicit database access. Pass --local for localhost, or --allow-remote-read only after verifying the target.",
    );
    process.exitCode = 2;
    return;
  }
  const rows = await readProfiles();
  const aggregated = aggregate(rows);
  printCounts(aggregated.byNorm, "university variants");
  const header = "variant,normalized,count\n";
  const body = [...aggregated.byRaw.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([variant, count]) => [variant, normalize(variant), count].map(escapeCsv).join(","))
    .join("\n");
  fs.writeFileSync(outPath, header + body + "\n", { encoding: "utf8" });
  console.log(`Wrote aggregate report: ${path.relative(REPO_ROOT, outPath)}`);
  if (mapArg) {
    const mapPath = path.resolve(REPO_ROOT, mapArg);
    const mappings = new Map();
    for (const line of fs.readFileSync(mapPath, "utf8").split(/\r?\n/).slice(1)) {
      const [variant, slug] = line.split(",").map((part) => part?.trim());
      if (variant && slug) mappings.set(variant, slug);
    }
    let mapped = 0;
    let unmapped = 0;
    for (const [variant, count] of aggregated.byRaw) {
      if (mappings.get(variant)) mapped += count;
      else unmapped += count;
    }
    console.log(`mapping preview: mapped=${mapped}, unmapped=${unmapped}`);
  }
}

await main();
