#!/usr/bin/env node
/**
 * Validates the KC117 meeting payloads and prints POST commands.
 *
 * Usage:
 *   node scripts/ingest-kc117-meetings.mjs
 *   node scripts/ingest-kc117-meetings.mjs --post --base http://localhost:3000
 *
 * The POST path needs the class UUID (not the slug) in each payload's
 * `classId`, and a logged-in cookie from the app. Without --post this
 * script only validates and prints the requests, so it never writes data.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const payloads = JSON.parse(
  readFileSync(join(dir, "ingest-kc117-meetings-1-12.json"), "utf8"),
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const args = new Set(process.argv.slice(2));

const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = baseArg?.split("=")[1] ?? "http://localhost:3000";

function fail(message) {
  console.error(`Invalid payloads: ${message}`);
  process.exit(1);
}

if (!Array.isArray(payloads) || payloads.length !== 12) {
  fail("expected 12 meetings");
}

for (const [index, item] of payloads.entries()) {
  if (item.meetingNumber !== index + 1) {
    fail(`meetingNumber must be ${index + 1} at index ${index}`);
  }

  if (!UUID_RE.test(item.subjectId)) {
    fail(`subjectId is not a UUID at meeting ${item.meetingNumber}`);
  }

  if (item.classId === "REPLACE_WITH_CLASS_UUID") {
    console.error(
      `meeting ${item.meetingNumber}: classId still placeholder — replace with the class UUID before posting`,
    );
  }

  if (new Date(item.startsAt).getTime() >= new Date(item.endsAt).getTime()) {
    fail(`startsAt must be before endsAt at meeting ${item.meetingNumber}`);
  }
}

console.log(`Validated ${payloads.length} meetings (1-12).`);

if (args.has("--post")) {
  for (const item of payloads) {
    console.log(
      `POST ${base}/api/classes/tplm002/attendance/meetings`,
      JSON.stringify(item),
    );
  }

  console.log(
    "Dry run only: re-run with an authenticated fetch (cookie) to actually create.",
  );
}
