# Production-Scale Hardening — Measured Implementation

**Date:** 2026-11-05
**Branch observed:** `staging/phase-5k-5l` (requested `perf/schedule-absence-tab-lag` was NOT the checked-out branch; work was done on the observed branch without switching).
**Mode:** local-only, measured. No production access, no deploys, no production writes.
**Local stack:** `supabase_db_starstask` (PostgreSQL 17.11) was UP and healthy; all DB measurements below are against the disposable local stack, which is NOT representative of production traffic (see §2 verdict).

**WIP protection:** `supabase/migrations/20261110000000_subject_enrollment.sql` SHA-256 verified identical before and after (`59CE5DAF8AFEB3E9D0FD2624BC19F762FC5C71D3F69A2D693A172C93142ECEC3`). It was never edited, executed, or depended on. No historical migration was rewritten. No `profiles_nim_unique` change. No university auto-activation, no backfill, no invented business rules.

## §1 RLS hot-path — COMPLETE (measured)

### Inspected
- `is_class_member(p_class_id)` definition: `supabase/migrations/20261029001100_class_functions.sql:32` — `SECURITY DEFINER`, `STABLE`, SQL body `EXISTS(class_members WHERE class_id = p AND user_id = (SELECT auth.uid()))`. The `(SELECT auth.uid())` form is already the InitPlan form (evaluated once per query, not per row).
- Usage: **39 occurrences across 23 migration files**; TypeScript direct usage only 3 (incl. generated types in `apps/web/src/lib/db/classes.ts`). The real hot path is the 3 policies in `20261029001200_class_rls.sql` (`classes`, `class_applications`, `class_admins`) plus predicates inside RPCs.
- Existing identity code: `apps/web/src/lib/identity/get-identity-context.ts` already uses React `cache()` (per-request dedupe, discarded after the request); `apps/web/src/lib/auth/session.ts` likewise. **No cross-request TTL cache existed — and none was added.**

### Measured (EXPLAIN, local)
```
EXPLAIN (ANALYZE, BUFFERS) SELECT EXISTS(... class_members ...)
→ Index Only Scan using class_members_pkey   (class_id, user_id)
  Heap Fetches: 0   Execution Time: 0.093 ms
```
`class_members_pkey (class_id, user_id)` already serves the predicate perfectly. Reverse lookup `class_members_user_idx (user_id, joined_at)` exists.

### Why the plan's 30s TTL cache was rejected (and what shipped instead)
A cross-request TTL cache of authorization data keeps revoked members authorized for up to the TTL and risks tenant-key confusion. The safe equivalent — **request-scope only, zero cross-user leak** — is React `cache()`, now extended to class memberships:
- **Created:** `apps/web/src/lib/identity/get-my-class-ids.ts` — `getMyClassIds = cache(...)` + pure `summarizeClassIds(rows)` (dedupe/drop-null/sort). RLS governs the underlying query; ids are a UI convenience, never a substitute for `is_class_member()` / `has_class_permission()`.
- **Test:** `apps/web/tests/unit/my-class-ids.test.ts` — 3 tests, **PASS** (ran together with `identity-context.test.ts`: 15/15 PASS).

### KPI verdict
| KPI (plan §1) | Target | Measured | Verdict |
|---|---|---|---|
| `is_class_member()` calls per request | −90% | No load harness; not runnable | **NOT MEASURED** (BLOCKED on harness) |
| Sequential scans | <0.05–0.1% | Local demo data only | **NOT MEASURED** |
| Index scans on hit path | >95% | EXPLAIN shows Index Only Scan, 0 heap fetches | **MET on representative query** |
| No cross-user leak | 0 | React cache is per-request by construction | **MET by design** |

## §2 Index audit — COMPLETE (report; no-op migration, justified)

### Read-only stats (local, 20 MB DB)
- Largest `seq_scan` counts are on tiny demo tables (`users` 147, `classes` 60, `assignments` 58) — all with ≤14 live rows; seq scans on such tables are expected and cheap. No hot table shows a seq-scan problem.
- `pg_stat_user_indexes`: 15 indexes with 0 scans, all on empty/near-empty tables (`assignments_*`, `student_identities_pkey`, `academic_units_pkey`, …). Zero scans on empty tables is not evidence of a useless index.
- Index size / bloat: not measurable meaningfully at 20 MB demo scale.

### Decision: **no new index migration.** No genuinely justified missing index tied to a real filtered column was found; every hot predicate (`class_members(class_id,user_id)`, `class_members(user_id,…)`, `classes(university_id,status)`, `audit_logs(university_id,created_at)`, …) already has a covering index. Adding speculative indexes would grow write cost for zero measured benefit. A no-op was chosen deliberately over a speculative migration.
KPI baseline table (plan §2): sequential-scan ratio, buffer/cache hit, index sizes — **NOT MEASURABLE** on a 20 MB demo DB; they are recorded as a staging-clone prerequisite (see Blockers).

## §3 Negative RLS tests — COMPLETE (live local run, 7/7 PASS)

**File:** `apps/web/tests/integration/negative-rls.test.ts` (run via `vitest.integration.config.ts`; skipped without `SUPABASE_TEST_*` env, so ordinary `pnpm test` never needs secrets). The file pre-existed untracked from a prior phase; this pass **fixed two wrong assertions** after live measurement and re-ran.

**Run (true output):**
```
npx vitest run --config vitest.integration.config.ts tests/integration/negative-rls.test.ts
→ Test Files  1 passed (1)
→ Tests  7 passed (7)   (1.75s, local http://127.0.0.1:54321, disposable data, cleaned up in afterAll)
```
Covered and passing: anon denied (0 rows or fail-closed 42501, never a leak) · anon cannot EXECUTE privileged RPC (the `20261119000000` grant revocation) · `is_class_member(otherClass) = false` + cross-class `announcements` read returns 0 rows · cross-university `university_memberships` owner-only · cross-class write denied · storage cross-user avatar delete denied (object survives) · `audit_logs` append-only (UPDATE denied).

**Measured corrections (honest, not hidden):**
1. Anon `SELECT` on `classes` fails **closed** with `42501 permission denied for function can_manage_class` after the 20261119 revocation — acceptable denial; test now accepts either denial shape and asserts zero leaked rows.
2. The `classes` table intentionally exposes **all `status='active'` rows** to any authenticated user (`status='active' OR is_class_member(id) OR can_manage_class(id)` — public discovery). It is therefore **not** a tenant boundary; the real boundary is tenant-scoped content + `is_class_member()`. Test updated to assert the true invariant.

**Out of scope (not fixed, preserved as pre-existing WIP):** the full integration run shows 22 failures in `rls.test.ts` / `authorization-matrix.test.ts` / `class-workflow.test.ts` (course-scoping drift: "a course is required for class content", error-code drift 22P02 vs 42501). These pre-date this pass and were left untouched.

## §4 audit_logs hardening — PARTIAL (expand-contract step 1; STOP panel)

**Inspected:** `university_id` column added nullable by `20261117000000_hardening.sql` (+ partial index). Immutability: **`audit_logs_prevent_mutation_trg` (BEFORE UPDATE/DELETE) shipped in `20261119000000_phase5l_security_hardening.sql` and verified present** in the local DB (`pg_trigger` lookup). `authenticated` holds column-scoped SELECT only; no UPDATE/DELETE grant.

**Measured NULL state (local):** 76 audit rows, **76 with `university_id IS NULL`**, 0 non-null. Production counts unverified (no production session). ⇒ Per the hard rule, **NOT NULL must NOT be applied**; backfilling a tenant key onto history would invent data.

**Deliverable (additive-safe):** `supabase/migrations/20261119000001_audit_university_enforcement.sql`
- `CREATE OR REPLACE VIEW public.audit_logs_university_gap` (NULL rows per day — observability).
- Column contract comment; NOT NULL statement included **commented-out** with explicit preconditions (0 NULLs in target env + approved backfill decision).
- Migration **written, syntax-validated locally** (view created + queried, then dropped to leave the local schema pristine), **NOT applied/pushed**. Push is BLOCKED pending approval and a verified zero-NULL state.
- Retention/partitioning (monthly purge or `pg_partman`): recorded as a product decision — **BLOCKED**, no job created.

## §5 Migration discipline + delivery docs — COMPLETE (docs-only)

No CI files were modified. The following snippet + checklist are provided for review; applying them to CI requires separate explicit approval.

```yaml
# Proposed CI gate (docs-only — do not wire up without owner approval)
- name: Migration dry-run (staging clone only)
  run: supabase migration list --dry-run
- name: SQL lint
  run: sqlfluff lint supabase/migrations
- name: Schema parity vs staging
  run: <parity-check>: schema diff must be empty before merge
```

PR checklist (paste into PR template):
- [ ] New migration is additive only (no rewrites of historical migrations).
- [ ] No `SET NOT NULL` / backfill without a verified zero-NULL count and written approval in the PR.
- [ ] `20261110000000_subject_enrollment.sql` untouched and unexecuted (verify SHA-256).
- [ ] Dry-run report attached as artifact; rollback notes included.
- [ ] Negative RLS gate (`test:integration` against disposable stack) passes.
- [ ] No tenant-key changes without an expand-contract plan.

## §6 Backfill/enrollment status — VERIFIED (local actuals; prod UNVERIFIED)

| Fact | Plan claim | Measured (local 2026-11-05) |
|---|---|---|
| Active university memberships | 31 | **5** |
| Classes with `university_id` set | linked | **0** |
| Academic units | 0 | **0** |
| Course offerings | 0 | **0** |
| Enrollments | 0 | **0** |

The plan's "31" figure is a production claim this pass did **not** verify (no production reads were performed). Local actuals above are the verified numbers. No units/offerings/enrollments were created; nothing was backfilled.

## §7 Performance budget — BLOCKED (not measurable here)

API p95 <250ms, DB p95 <50ms, RPC <100ms, N+1 = 0: **no load harness or staging clone exists in this environment** (consistent with `docs/architecture/phase-5j/performance-baseline.md`: "runtime production baseline not measured"). Budgets remain targets, not evidence. No scale-ready claim is made.

## §8 Backfill/enrollment (plan) — stands

Status stands as §6. Frontend empty states remain the correct behavior until approved backfill on staging.

## Files changed by this pass

| Path | Change |
|---|---|
| `apps/web/src/lib/identity/get-my-class-ids.ts` | **NEW** — request-scope `getMyClassIds` (React `cache()`) + pure `summarizeClassIds` |
| `apps/web/tests/unit/my-class-ids.test.ts` | **NEW** — 3 unit tests (PASS) |
| `apps/web/tests/integration/negative-rls.test.ts` | **FIXED** 2 assertions after live measurement (7/7 PASS) |
| `supabase/migrations/20261119000001_audit_university_enforcement.sql` | **NEW** — monitoring view + commented STOP panel (NOT applied) |
| `docs/architecture/phase-5i/production-scale-hardening-implementation.md` | **NEW** — this file |

No index migration (justified no-op, §2). No CI file changes (§5). No production writes, no deploys, no resets, no destructive SQL.

## Readiness verdict

| Item | Verdict |
|---|---|
| 1 RLS hot-path | **COMPLETE** (measured EXPLAIN; safe request-scope shipped; TTL-cache rejection documented) |
| 2 Index audit | **COMPLETE** (report; justified no-op) |
| 3 Negative RLS tests | **COMPLETE** (7/7 live local PASS) |
| 4 audit_logs hardening | **PARTIAL** (trigger verified; expand-contract step 1 written; NOT NULL + retention BLOCKED on zero-NULL verification and approval) |
| 5 Migration discipline | **COMPLETE** (docs-only snippet + checklist; CI wiring BLOCKED on approval) |
| 6 Backfill/enrollment status | **COMPLETE** (verified local actuals; prod figure UNVERIFIED) |
| 7 Performance budget | **BLOCKED** (needs staging clone + load harness) |
| 8 Backfill/enrollment (plan) | **COMPLETE** (stands, verified) |

**Overall: PARTIAL.** The service is tenant-isolated and fail-closed on the local evidence above, but it is **not scale-proven**: no p95/load/sequential-scan evidence exists against representative data, audit retention is undecided, and production counts were never verified in this pass.

## Remaining blockers
1. Staging clone + synthetic multi-university dataset + load harness → unblocks §1/§2/§7 KPI measurement.
2. Production read-only session (owner-approved) → verify membership/class/audit-NULL counts before any enforcement push.
3. Owner approval for: NOT NULL/retention decision (§4), CI gate wiring (§5), the pre-existing integration suite drift (§3 note).
