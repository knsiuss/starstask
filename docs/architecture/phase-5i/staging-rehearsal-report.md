# StarsTask — Staging Rehearsal Report (Phase 5I follow-up)

**Date:** 2026-11-05 · **Branch:** `staging/phase-5k-5l` (observed, never switched)
**Mode:** local disposable stack ONLY. No production access, no deploys, no
production writes, no cron pushes. Nothing below represents production scale.

**Protection proof:** `supabase/migrations/20261110000000_subject_enrollment.sql`
SHA-256 `59CE5DAF8AFEB3E9D0FD2624BC19F762FC5C71D3F69A2D693A172C93142ECEC3`
verified identical at start and end. The file was never executed, edited, or
depended on. No historical migration rewritten. `supabase db reset` and
`supabase db push` were never run.

## 1. Staging bootstrap — COMPLETE (with one honest gap)

**Stack:** `supabase_db_starstask` (PostgreSQL 17) already UP and healthy
(11 supervised containers; rest/auth/storage/kong up 19h). All commands below
targeted the **local** endpoint `127.0.0.1:54322` only — never `--remote`,
never the linked project `kdqsrckmmoucdqiapovr`.

**Finding:** the local `supabase_migrations.schema_migrations` history stopped
at `20261109000000` (82 versions) while the on-disk tree had 11 more files
(`20261110`–`20261119000001`). But the local schema already contained the
phase-5 signatures (`universities`, `enrollments`, `attendance_records`,
`audit_logs.university_id`, `audit_logs_prevent_mutation_trg`), so a blind
`supabase migration up` failed correctly:
`ERROR: trigger "universities_set_updated_at" ... already exists`.

**Adoption path used (established local path, no reset):**

1. `supabase migration repair 20261110000000 --status applied` — history row
   only. **The file was NOT executed.** `class_subject_members` (its sole
   table) is intentionally absent locally; nothing in Nov11–19 references it
   (verified by grep). Documented limitation, not load-bearing for this suite.
2. Signature verification per migration (tables/functions/triggers present),
   then `supabase migration repair 20261111…20261119000000 --status applied`.
3. **One genuine gap found and closed:** `session_checkin_summary_many`
   (Nov18's only object) was missing. Its content was applied locally via
   `psql -v ON_ERROR_STOP=1` — `CREATE OR REPLACE` + grants, fully additive —
   and verified to exist.
4. `20261119000001` view created locally the same way (`ON_ERROR_STOP`,
   §6), then recorded applied.

**End state:** 93 history versions. `supabase migration list` (local target)
shows all 93 as local+remote matched. No remote command was issued.

## 2. Synthetic multi-university seed — COMPLETE (local, disposable)

**Files:** `supabase/tests/staging-synthetic-seed.sql`,
`supabase/tests/staging-synthetic-cleanup.sql` (child-first, `syn-` scoped).

**Inventory (verified by `SELECT count(*)`, no PII):**

| Table                             | Count                                                     |
| --------------------------------- | --------------------------------------------------------- |
| universities (`syn-uni-a/b`)      | 2                                                         |
| university_memberships            | 4 (student+admin per uni)                                 |
| student_identities                | 4                                                         |
| classes (`syn-class-a1/a2/b1/b2`) | 4                                                         |
| class_members                     | 6 (3 per uni incl. admin — FK requires admins be members) |
| class_admins                      | 2                                                         |
| course_offerings                  | 2                                                         |
| attendance_meetings               | 4                                                         |
| attendance_records                | 8                                                         |

All emails `@synth.local`, all slugs `syn-`. Two real errors were caught and
fixed during seeding (FK `class_admins→class_members`; `status='held'` not in
the meetings check set — valid values `scheduled/open/closed/cancelled`), then
seeded clean. Re-running the seed inserts nothing new (guarded by slug).
Cleanup script verified (see §7): leaves 0 `syn-` rows.

## 3. Negative RLS suite — COMPLETE (executed: 11/11 PASS)

**File:** `apps/web/tests/integration/negative-rls.test.ts` (extended from 7
to 11 tests; the pre-existing 7 all still pass). Run against the local stack:

```
npx vitest run --config vitest.integration.config.ts tests/integration/negative-rls.test.ts
→ Test Files 1 passed · Tests 11 passed (11) · 2.93s
```

Coverage (all TRUE results, nothing asserted without measurement):
anon denied (`classes` 0 rows / fail-closed 42501) · anon cannot EXECUTE
privileged RPC · cross-class read denied (`is_class_member=false`,
announcements 0 rows) · cross-university membership reads owner-only ·
cross-class write denied · **cross-university write denied** (new) ·
**unauthorized class admin of classB writing classA denied** (new) ·
**authenticated non-admin cannot create classes** (new) ·
storage cross-user avatar delete denied (object survives) ·
**storage signed-URL denial on private bucket** (new) · `audit_logs`
append-only (no UPDATE grant).

**TRUE finding (corrected test):** the first signed-URL attempt used the
`avatars` bucket and SUCCEEDED — because `avatars.public = true` and
`avatars_storage_read` grants `SELECT` to `anon, authenticated` for any
object. A signed URL on a public object is not a policy boundary. The test
now targets `verification-evidence` (private, owner-scoped SELECT), where
cross-user `createSignedUrl` IS denied — 11/11 reflects this correction.

## 4. Load/async harness — COMPLETE (measured, tiny scale) + 1 BLOCKED gap

**File:** `apps/web/tests/perf/load-harness.mjs` (deterministic, sequential,
25 iterations/flow, `service_role`, pagination `range(0,9)`; no cross-user
auth caching — per-call headers, results discarded).

| Flow                       | Queries/call | p50     | p95     | min     | max      |
| -------------------------- | ------------ | ------- | ------- | ------- | -------- |
| dashboard list (`classes`) | 1            | 13.64ms | 69.41ms | 3.41ms  | 128.36ms |
| class members (paginated)  | 1            | 11.18ms | 23.38ms | 3.63ms  | 31.75ms  |
| attendance roster          | 2            | 50.65ms | 98.85ms | 12.33ms | 119.32ms |
| notification inbox         | —            | —       | —       | —       | —        |

**N+1 guard: PASS** — every flow ≤ 3 queries per request by construction.
Harness exits 1 if any flow exceeds the bound.

**BLOCKED:** notification inbox cannot be measured — **no `notifications`
table exists** in the local schema. This is a genuine product/schema gap,
not a harness omission. The harness reports it explicitly instead of faking
a number. Roster takes 2 queries (1 resolve + 1 page) because the harness
resolves the university id inline; production code should reuse
`get-my-class-ids` (request-scope) rather than fan out.

**Server-side cost (EXPLAIN, seeded data):** membership predicate executes
in ~0.095ms (same as the prior 0.093ms baseline). Note: at 6-member scale the
planner correctly picks `Seq Scan` over `Index Only Scan` (a seq scan on
6 rows is optimal); the Index-Only-Scan proof from the prior pass stands for
realistic row counts.

**Scale honesty:** these numbers are against 4 classes / 8 attendance rows /
~21MB DB. They prove the query shapes are bounded, NOT that p95 targets
(250ms API / 50ms DB) hold at 1000-concurrent. No scale-ready claim is made.

## 5. Index audit refresh (post-seed) — COMPLETE (read-only)

- Sequential-scan ratio: **50.538%** (4460 seq / 4365 idx across all public
  tables). On demo scale this is a small-table artifact — seq scans on
  ≤20-row tables are the planner's correct choice. It is NOT comparable to
  the plan's <0.05–0.1% production target.
- Top seq tables: `classes` 259/345, `assignments` 227/8, `universities`
  210/286 — all tiny.
- Buffer hit: **99.927%** (≥99% target met at this scale). DB size 21MB.
- Unused indexes (idx_scan=0): all on empty/near-empty tables
  (`academic_units`, `app_activity_events`, `assignment_revisions`, …).
  Zero scans on empty tables is not evidence of uselessness.
- **Decision: no new index migration** (same justified no-op as prior pass).
  Every hot predicate already has a covering index.

## 6. Audit hardening follow-up — COMPLETE (STOP panel holds; nothing pushed)

- `audit_logs_university_gap` view applied **locally only** via
  `psql -v ON_ERROR_STOP=1`, queried (returns 76 rows for 2026-11-05), then
  recorded in history. Not pushed anywhere.
- NULL state re-measured post-seed: **76 rows, 76 NULL, 0 non-null.**
  `audit_logs_prevent_mutation_trg` verified present and enabled.
- `NOT NULL` remains impossible without inventing tenant keys onto history:
  **STOP panel kept** (zero-NULL + approved-backfill preconditions unchanged).
- Retention/partitioning: still a product decision — BLOCKED, no job created.

## 7. Regression — COMPLETE

| Check                                              | Result                                       |
| -------------------------------------------------- | -------------------------------------------- |
| `npx vitest run` (full unit suite)                 | **101 files, 1135 tests PASS** (10.6s)       |
| `npx tsc --noEmit`                                 | **exit 0**                                   |
| `eslint` on 4 changed/new TS files                 | **exit 0**                                   |
| `supabase/tests/phase5c-5g-validation.sql` (local) | **PHASE5C-5G PASS · RLS PASS · LEGACY PASS** |

WIP preservation: `git status` at start and end shows the same unrelated WIP
set (`.env.example`, `AGENTS.md`, `apps/web/next.config.ts`, etc.). This pass
touched **only**: `apps/web/tests/integration/negative-rls.test.ts`,
`supabase/tests/staging-synthetic-seed.sql` (new),
`supabase/tests/staging-synthetic-cleanup.sql` (new),
`apps/web/tests/perf/load-harness.mjs` (new), and this report. Nothing else.

## Remaining blockers & decisions

1. **Notifications table gap** (§4): no `notifications` table → inbox flow
   unmeasurable and the feature unbuildable until schema exists.
2. **Production verification:** all counts are local. A production read-only
   session (owner-approved) is still needed before any enforcement push.
3. **NOT NULL + retention** (§6): need verified zero-NULL state + approved
   backfill/retention decision. Push of `20261119000001` is recorded
   `applied` locally only; remote push remains BLOCKED on the same gate.
4. **Nov10 schema adoption:** `class_subject_members` table is absent locally
   by design (protected file never executed). If staging needs it, that
   requires the owner's explicit instruction about that file.
5. **Pre-existing integration drift** (prior pass, preserved untouched):
   `rls.test.ts` / `authorization-matrix.test.ts` / `class-workflow.test.ts`
   failures pre-date this work.
6. **Load-scale readiness:** NOT proven. Needs staging-clone data volume
   (100k+ rows), RLS-parity harness timing (authenticated path, not
   service_role), and a chatty dashboard capture to prove the is_class_member
   per-request budget.
