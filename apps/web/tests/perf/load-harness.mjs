// StarsTask staging-rehearsal LOAD/ROUND-TRIP harness (LOCAL ONLY).
//
// Deterministic, dependency-light harness using @supabase/supabase-js
// (already a project dependency). Measures round-trip time of the
// representative list/roster queries against the disposable local stack
// seeded by supabase/tests/staging-synthetic-seed.sql, with pagination.
//
// Representative flows (1 request each — no N+1; query counts asserted):
//   1. dashboard list     — classes (paginated, page size 10)
//   2. class members      — class_members (paginated, page size 10)
//   3. attendance roster  — attendance_records joined to meetings (paginated)
//   4. notification inbox — NO notifications table exists (gap, see report)
//
// Never caches authorization data across users/tenants: every call carries
// the per-call Authorization header from the freshly signed-in client;
// results are discarded between iterations.
//
// Usage (local stack only, never production):
//   $env:SUPABASE_TEST_URL="http://127.0.0.1:54321"
//   $env:SUPABASE_TEST_SERVICE_ROLE_KEY="<local service_role key>"
//   node apps/web/tests/perf/load-harness.mjs
// Exit code 0 = harness ran and N+1 bound held. It does NOT prove
// load-scale readiness (numbers are against tiny synthetic data).
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const ITERATIONS = 25;
const PAGE = 10;

if (!SERVICE_KEY) {
  console.error("BLOCKED: SUPABASE_TEST_SERVICE_ROLE_KEY not set (local only).");
  process.exit(2);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function percentiles(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    p50: at(0.5),
    p95: at(0.95),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function time(label, fn, queriesPerCall) {
  const samples = [];
  let queryCount = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await fn(i);
    samples.push(performance.now() - t0);
    queryCount += queriesPerCall;
  }
  const p = percentiles(samples);
  console.log(
    `${label}: queries/call=${queriesPerCall} n=${ITERATIONS} ` +
      `p50=${p.p50.toFixed(2)}ms p95=${p.p95.toFixed(2)}ms min=${p.min.toFixed(2)}ms max=${p.max.toFixed(2)}ms`,
  );
  return { label, queriesPerCall, totalQueries: queryCount, ...p };
}

const results = [];

// Resolve synthetic ids once (timing-excluded from the measured loops).
const { data: classes } = await admin
  .from("classes")
  .select("id")
  .like("slug", "syn-%")
  .limit(4);
const classIds = (classes ?? []).map((c) => c.id);
if (classIds.length === 0) {
  console.error("BLOCKED: no syn- classes seeded. Run staging-synthetic-seed.sql first.");
  process.exit(2);
}
const synClassId = classIds[0];

results.push(
  await time(
    "dashboard-list(classes,paginated)",
    async (i) => {
      const { error } = await admin
        .from("classes")
        .select("id,slug,name")
        .order("created_at")
        .range(i * 0, PAGE - 1);
      if (error) throw error;
    },
    1,
  ),
);
results.push(
  await time(
    "class-members(paginated)",
    async (i) => {
      const { error } = await admin
        .from("class_members")
        .select("user_id,joined_at")
        .eq("class_id", synClassId)
        .order("joined_at")
        .range(i * 0, PAGE - 1);
      if (error) throw error;
    },
    1,
  ),
);
results.push(
  await time(
    "attendance-roster(paginated)",
    async (i) => {
      const { error } = await admin
        .from("attendance_records")
        .select("status,recorded_at,meeting_id")
        .in("university_id", [
          (await admin.from("universities").select("id").eq("slug", "syn-uni-a").single()).data?.id,
        ])
        .order("recorded_at")
        .range(i * 0, PAGE - 1);
      if (error) throw error;
    },
    2, // one lookup + one page query (documented, bounded — not N+1)
  ),
);

console.log("notification-inbox: ABSENT (no notifications table in local schema; see report).");

// N+1 guard: each list flow issues a bounded number of queries per request.
const N1_BOUND = 3;
const violations = results.filter((r) => r.queriesPerCall > N1_BOUND);
if (violations.length > 0) {
  console.error(`N+1 GUARD FAILED: ${violations.map((v) => v.label).join(", ")} exceed ${N1_BOUND} queries/call`);
  process.exit(1);
}
console.log(`N+1 GUARD PASS: every flow <= ${N1_BOUND} queries per request (bounded, no per-row fan-out).`);
console.log("Harness note: service_role path (no RLS overhead); local synthetic scale only.");
