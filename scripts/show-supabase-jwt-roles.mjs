#!/usr/bin/env node
// Prints only the broad role claim of the local Supabase JWTs. Never prints keys.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps",
  "web",
  ".env.local",
);
const env = {};

for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  let value = t.slice(i + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[t.slice(0, i).trim()] = value;
}

for (const key of [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
]) {
  const token = env[key];
  if (!token) {
    console.log(`${key}: missing`);
    continue;
  }
  if (!token.startsWith("eyJ")) {
    console.log(`${key}: not_a_jwt`);
    continue;
  }
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    console.log(`${key}: role=${json.role ?? "unknown"}`);
  } catch {
    console.log(`${key}: unreadable`);
  }
}
