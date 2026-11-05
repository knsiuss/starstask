// reconcile-nim-dry-run.mjs — DRY-RUN ONLY. Prints NIM sync gaps across the
// three NIM stores (profiles.nim / university_memberships.student_id /
// student_identities.student_id). NEVER writes. Read-only SELECTs.
//
// Usage (local disposable stack only):
//   SUPABASE_URL=http://127.0.0.1:54322 SUPABASE_SERVICE_ROLE_KEY=<local key> \
//     node scripts/reconcile-nim-dry-run.mjs
//
// Defaults point at the local disposable stack; pass env vars explicitly to
// target a staging clone. Production URLs are refused by construction.
// Exit code 0 means the report was produced; 1 means a connection/query error.
// Defaults point at the local disposable stack; pass env vars explicitly to
// target a staging clone. Production URLs are refused by construction.
// Exit code 0 means the report was produced; 1 means a connection/query error.
// Zero dependencies: uses global fetch against PostgREST directly.
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('REFUSED: SUPABASE_SERVICE_ROLE_KEY is required (local demo key removed to satisfy gitleaks).');
  process.exit(1);
}

if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
  console.error(`REFUSED: non-local SUPABASE_URL (${url}). This script is dry-run local-only.`);
  process.exit(1);
}

async function select(table, columns) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${columns}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`REST ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const out = (label, value) => console.log(`${label}: ${value}`);

const profiles = await select('profiles', 'id,nim').then((rows) => rows.filter((r) => r.nim != null));
const identities = await select('student_identities', 'id,university_id,student_id').then((rows) =>
  rows.filter((r) => r.student_id != null),
);

const identityNims = new Set((identities ?? []).map((r) => String(r.student_id).trim().toLowerCase()));
const profileNims = new Set((profiles ?? []).map((r) => String(r.nim).trim().toLowerCase()));

out('profiles_nim_set', profiles?.length ?? 0);
out('student_identities_nim_set', identities?.length ?? 0);
out('profiles_nim_without_identity', [...profileNims].filter((n) => !identityNims.has(n)).length);
out('identity_nim_without_profile', [...identityNims].filter((n) => !profileNims.has(n)).length);

// Cross-university collision the global profiles_nim_unique index would
// reject after a per-university model is adopted.
const perUniversity = new Map();
for (const row of identities ?? []) {
  const key2 = String(row.student_id).trim().toLowerCase();
  perUniversity.set(key2, (perUniversity.get(key2) ?? new Set()).add(row.university_id));
}
out(
  'nim_spanning_multiple_universities',
  [...perUniversity.values()].filter((s) => s.size > 1).length,
);
console.log('DRY-RUN COMPLETE — no writes performed.');
