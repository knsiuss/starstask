# Performance comparison — Phase 5K

> **Date:** 2026-11-05. **Status: isolated scratch DB only. Production NOT measured.**
> All numbers are directional and taken from one synthetic 120-session dataset.

## 1. Before / after benchmark

Dataset: 120 synthetic sessions in one synthetic class for one synthetic member. Application data NOT measured (requires live traffic + pg_stat_statements snapshot from an authorized production read).

| Metric                        | Before (N+1)                      | After (batched)                   | Delta                   |
| ----------------------------- | --------------------------------- | --------------------------------- | ----------------------- |
| RPC round-trips per list page | `N` (120 in test)                 | `1`                               | `-119 RTT` at 120 items |
| Buffer hits (shared hit)      | 3231                              | 1379                              | **−57%**                |
| Planning time                 | ~1.015 ms                         | ~0.146 ms                         | —                       |
| Execution time                | ~43.887 ms (~48.017 ms on re-run) | ~19.946 ms (~23.772 ms on re-run) | **~2.2× faster**        |
| Rows returned                 | 120                               | 120                               | same                    |
| Output mismatch               | —                                 | —                                 | **0 / 120**             |

Measurement details: `EXPLAIN (ANALYZE, BUFFERS)` in `supabase/tests/phase5k-session-checkin-summary-many-benchmark.sql`, run only in DB `starstask_phase5k_20261105`.

## 2. Query plan summary

### Before (ProjectSet of `session_checkin_summary`)

- Node type: `ProjectSet` calling the scalar helper once per row
- 120 loops; shared hit=3231

### After (FunctionScan on `session_checkin_summary_many`)

- Node type: `Function Scan` on `session_checkin_summary_many(p_session_ids uuid[])`
- InitPlan: `Aggregate` + `Sort` + `Seq Scan on discussion_sessions` (the 120 rows)
- shared hit=1379; rows=120

> Both plans still `Seq Scan` `discussion_sessions` at this volume; there is **no demonstrated need** for a new index on the scratch DB. Adding one would increase write cost without proven benefit.

## 3. Index audit (measured, not changed)

| Table / area                             | Existing indexes                                                                       | Candidate    | Verdict                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------- |
| `class_members`                          | PK `(class_id, user_id)`, user index; no seq-scan measured                             | none         | Deferred — no workload bottleneck observed              |
| `discussion_session_checkins`            | PK + session-scoped indexes exist                                                      | none         | Deferred — no `EXPLAIN` showing seq-scan starvation     |
| `assignments` + `assignment_completions` | PK + scoped indexes exist                                                              | none         | Deferred                                                |
| `audit_logs`                             | Append-only hot path (Phase 3: 23k seq scans — Phase 3 numbers, not re-measured in 5K) | none changed | Needs staging traffic + `pg_stat_statements` before DDL |
| notification tables                      | Outbox + claim RPCs; claim uses `FOR UPDATE SKIP LOCKED`                               | none changed | Deferred                                                |

**Rule applied:** no index without staging + `EXPLAIN (ANALYZE, BUFFERS)` proving benefit. If a future pass wants this, the bar is: `EXPLAIN` shows a plan that still **seq-scans** the table at representative volume, and the new index changes that plan at acceptable write overhead.

## 4. Exact `count: "exact"` — audit of 45 occurrences (no code changed)

| File                                                                                                                                  | Lines (approx.)                | What it feeds                            | Suggested action                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/web/src/lib/db/dashboard.ts`                                                                                                    | 161,168,183,193,698            | task totals (user-visible)               | Keep — user-visible                                                                |
| `apps/web/src/lib/db/assignments.ts`                                                                                                  | 252,463,465                    | admin/assignment list totals             | Keep for pagination totals; head-only variant when only count needed               |
| `apps/web/src/lib/db/classes.ts`                                                                                                      | 525,803,844,996,1036,1379,1697 | class list + member counts               | Keep — user-visible                                                                |
| `apps/web/src/lib/db/admin.ts`                                                                                                        | 258                            | admin assignment list                    | Keep                                                                               |
| `apps/web/src/lib/db/leave.ts`                                                                                                        | 370,457,911,1150               | leave list totals                        | Keep                                                                               |
| `apps/web/src/lib/db/notifications.ts`                                                                                                | 93,105,144                     | inbox counts (user-visible badge)        | Keep; cheapest alternative is estimated count with staleness warning — not applied |
| `apps/web/src/lib/db/verification.ts`                                                                                                 | 339                            | verification list pagination             | Keep                                                                               |
| `apps/web/src/lib/db/class-actions.ts`, `class-submissions.ts`, `assignment-trust.ts`, `developer*.ts`, `features/*`, `lib/push/*.ts` | —                              | internal existence checks (`head: true`) | Safe to keep `head: true` counts; they already skip row payload.                   |

**No count was removed** in 5K, because the plan/impact for each would need production `pg_stat_statements` evidence before a correctness risk to pagination/total counts.

## 5. Connection management

| Area                                                     | Finding (from config)                                                                                                                                                                                           | 5K action              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `max_rows = 1000` (`supabase/config.toml` [api])         | Per-query row cap, not a migration change                                                                                                                                                                       | No change              |
| `max_connections = 60` (Supabase default in local stack) | Direct connections from serverless would saturate above ~60 concurrent; Supavisor (transaction mode) multiplexes — **do not add PgBouncer** (per brief: existing Supavisor functionality satisfies requirement) | No change; note for 5N |
| Cookie/session refresh in `proxy.ts`                     | Issue calls on demand                                                                                                                                                                                           | No change              |
| Prep statements / named prepared statements              | supabase-js uses parameter binding via PostgREST; no migration change                                                                                                                                           | No change              |

## 6. What remains NOT MEASURED

- Production p50/p95/p99
- Application-level RPC count per page in production (needs `pg_stat_statements` snapshot from an authorized production read)
- Connection pool saturation under load
- Index write amplification numbers (no index changed)
