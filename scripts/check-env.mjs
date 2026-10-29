#!/usr/bin/env node
/**
 * Preflight check for the environment variables StarsTask needs.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local scripts/check-env.mjs
 *
 * Exits with code 1 when a required value is missing or malformed, so a broken
 * deployment fails at build time instead of at the first request.
 */

const REQUIRED = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    check: (value) =>
      isHttpUrl(value) && /\.supabase\.(co|in)$/.test(new URL(value).hostname),
    hint: "Supabase project URL, e.g. https://abcdefgh.supabase.co",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    check: (value) => value.length >= 20,
    hint: "Supabase publishable key (Project Settings > API)",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    check: (value) => isHttpUrl(value),
    hint: "Public origin used for OAuth redirects, e.g. https://starstask.app",
  },
  {
    name: "RATE_LIMIT_SALT",
    check: (value) => value.length >= 32,
    hint: "Random 32+ character salt (see scripts/new-rate-limit-salt.mjs)",
  },
];

const OPTIONAL_PAIRS = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  [
    "SUPABASE_TEST_URL",
    "SUPABASE_TEST_ANON_KEY",
    "SUPABASE_TEST_SERVICE_ROLE_KEY",
  ],
];

// Push is all-or-none: a half-configured deployment would silently stop
// sending reminders, so fail the build instead.
const PUSH_GROUP = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];

function isHttpUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const failures = [];

for (const { name, check, hint } of REQUIRED) {
  const value = process.env[name]?.trim();

  if (!value) {
    failures.push(`${name} is missing. ${hint}`);
    continue;
  }

  if (!check(value)) {
    failures.push(`${name} is malformed. ${hint}`);
  }
}

if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  failures.push(
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must never exist: a service-role key in a NEXT_PUBLIC_ variable ships to the browser.",
  );
}

for (const pair of OPTIONAL_PAIRS) {
  const present = pair.filter((name) => Boolean(process.env[name]?.trim()));

  if (present.length > 0 && present.length !== pair.length) {
    failures.push(
      `Partially configured: ${pair.join(", ")}. Set all of them or none (missing: ${pair
        .filter((name) => !present.includes(name))
        .join(", ")}).`,
    );
  }
}

const pushPresent = PUSH_GROUP.filter((name) =>
  Boolean(process.env[name]?.trim()),
);

if (pushPresent.length > 0 && pushPresent.length !== PUSH_GROUP.length) {
  failures.push(
    `Partially configured push notifications: ${PUSH_GROUP.join(", ")}. Set all of them or none (missing: ${PUSH_GROUP.filter(
      (name) => !pushPresent.includes(name),
    ).join(", ")}).`,
  );
}

if (process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY) {
  failures.push(
    "NEXT_PUBLIC_VAPID_PRIVATE_KEY must never exist: a VAPID private key in a NEXT_PUBLIC_ variable ships to the browser.",
  );
}

if (
  process.env.VAPID_SUBJECT &&
  !/^(mailto:|https:\/\/)/i.test(process.env.VAPID_SUBJECT)
) {
  failures.push("VAPID_SUBJECT must be a mailto: address or an https: URL.");
}

if (process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length < 32) {
  failures.push("CRON_SECRET must be at least 32 characters.");
}

if (failures.length > 0) {
  console.error("Environment check failed:\n");

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exit(1);
}

console.log("Environment check passed.");
