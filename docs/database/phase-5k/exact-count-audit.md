# Exact-count audit — Phase 5K

> **Date:** 2026-11-05. **45 occurrences of `count: "exact"`** across `apps/web/src`.
> **Rule:** no silent global replace; no code in this phase changes any count.

## 1. Distribution

| File                                                        | # of `count: "exact"` |
| ----------------------------------------------------------- | --------------------- |
| `apps/web/src/features/assignments/assignment-service.ts`   | 1                     |
| `apps/web/src/features/classes/class-submission-service.ts` | 1                     |
| `apps/web/src/lib/db/admin.ts`                              | 1                     |
| `apps/web/src/lib/db/assignment-trust.ts`                   | 1                     |
| `apps/web/src/lib/db/assignments.ts`                        | 3                     |
| `apps/web/src/lib/db/class-actions.ts`                      | 4                     |
| `apps/web/src/lib/db/class-submissions.ts`                  | 6                     |
| `apps/web/src/lib/db/classes.ts`                            | 7                     |
| `apps/web/src/lib/db/dashboard.ts`                          | 5                     |
| `apps/web/src/lib/db/developer-operations.ts`               | 3                     |
| `apps/web/src/lib/db/developer.ts`                          | 3                     |
| `apps/web/src/lib/db/leave.ts`                              | 4                     |
| `apps/web/src/lib/db/notifications.ts`                      | 3                     |
| `apps/web/src/lib/db/verification.ts`                       | 1                     |
| `apps/web/src/lib/push/session-store.ts`                    | 1                     |
| `apps/web/src/lib/push/store.ts`                            | 1                     |
| **Total**                                                   | **45**                |

Sample lines (verified by grep):

- `features/assignments/assignment-service.ts:142` — `.select("id", { count: "exact", head: true })`
- `features/classes/class-submission-service.ts:234` — head-only existence check
- `lib/db/admin.ts:258` — paginated admin assignment list (count feeds `totalPages`)
- `lib/db/assignment-trust.ts:141` — head-only
- `lib/db/assignments.ts:252,463,465` — list totals + public-course existence check
- `lib/db/class-actions.ts:67,75,83,93` — four head-only existence checks
- `lib/db/class-submissions.ts:183,322,328,341,348,355` — submission list + existence checks
- `lib/db/classes.ts:525,803,844,996,1036,1379,1697` — class list + member counts
- `lib/db/dashboard.ts:161,168,183,193,698` — dashboard task totals (user-visible)
- `lib/db/developer-operations.ts:134,208,263` — developer counters (head-only)
- `lib/db/developer.ts:312,346,350`
- `lib/db/leave.ts:370,457,911,1150` — leave list totals
- `lib/db/notifications.ts:93,105,144` — inbox counts (user-visible badge)
- `lib/db/verification.ts:339` — verification list pagination
- `lib/push/session-store.ts:119`, `lib/push/store.ts:135` — push store counts

## 2. Disposition per row

| Category                                     | Count | Disposition                                                                                                     |
| -------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| head-only existence checks (`head: true`)    | ~24   | Keep — they already skip row payload. Alternative would be `head` + PostgREST `Prefer: count=exact`, same cost. |
| Paginated list totals (`totalPages`)         | ~9    | Keep — user-visible totals. Removing would change UI (no pager).                                                |
| Dashboard / notification user-visible counts | ~8    | Keep. Estimated counts need staleness warning — not introduced silently.                                        |
| Other / internal counters                    | ~4    | Keep until `pg_stat_statements` shows they are hot.                                                             |

**Zero counts were deleted or replaced in Phase 5K.** Each row would need a production `pg_stat_statements` entry before a correctness risk to pagination/totals is taken.

## 3. How to make future a candidate (bar for any change)

1. Production snapshot of `pg_stat_statements` shows that specific query in top 25 by total_exec_time.
2. Staging `EXPLAIN (ANALYZE, BUFFERS)` on that exact query shows non-index seq-scan.
3. Only then: replace `count: "exact"` with a staged approach and re-measure.
