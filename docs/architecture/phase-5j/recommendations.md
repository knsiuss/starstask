# Recommendations — Phase 5J

> **Scope:** sequencing, validation gates, and candidate optimizations. **All changes pending evidence.**
> **Status:** No production change approved by this document.

## 1. Immediate gate before 5K/5L

1. Create a fresh staging database from committed migrations.
2. Ensure Phase 5 activation ADR-002 is decided; without it, multi-tenant code remains inert.
3. Exclude `20261110000000_subject_enrollment.sql` unconditionally.
4. Establish production read-only snapshot and file evidence:
   - `pg_stat_statements` top 25.
   - `pg_stat_user_tables` for seq scans / dead tuples.
   - connection count and cache hit ratio.
5. Define capacity target (e.g. class count, concurrent sessions) before tuning.

## 2. Phase 5K candidate evaluations

Only after baseline is captured on staging:

| Candidate                                                                                                         | Evaluation method                                                 | Disposition                                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `class_members` and RLS-helper index path                                                                         | EXPLAIN (ANALYZE, BUFFERS) + request benchmark                    | Benchmark; do not add arbitrary indexes           |
| N+1 `session_checkin_summary`                                                                                     | Compare current RPC count per page; test single set-returning RPC | Fix only if hot path confirmed                    |
| Composite `(class_id, created_at)` / `(user_id, created_at)` on attendance, check-ins, audit, notification tables | Check actual access order                                         | Consider only with query evidence                 |
| Exact `count: "exact"` replacement                                                                                | Measure count query costs                                         | Per route; avoid blanket swap                     |
| FK coverage on high-query columns                                                                                 | Compare unused vs unindexed FK                                    | Staging DDL only                                  |
| `CREATE INDEX CONCURRENTLY` for production                                                                        | Confirm table lock + migration tool behavior                      | Never inside a transaction if Postgres rolls back |

## 3. Phase 5L caching candidates (not implemented)

| Category               | Candidate                                                           | Invalidation                                                       |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Public static          | Public catalog/product data                                         | deploy/version-bound static revalidation                           |
| Semi-static            | `academic_units`, `academic_years`, `semesters`, catalogue metadata | membership/activation or admin writes invalidate                   |
| Frequent mutable       | assignments/notifications/announcements/attendance                  | short TTL or no cache for authorization-critical pages             |
| Personalized/sensitive | profiles, memberships, permissions, private class data              | per-user key or no shared cache; authorization remains server-side |

**Do not add Redis** until a measured cache-miss cost and operational budget justify shared infrastructure. Next.js request memoization and route segment config are lower-risk candidates to benchmark first.

## 4. Phase 5M security tests required

- Synthetic University A/B users, classes, students, admins.
- Verify anon cannot read Phase 5 tenant tables.
- Cross-university SELECT/INSERT/UPDATE/DELETE rejected.
- Role revoke and suspension immediate effect.
- Storage policy checks; `class-media` public bucket remains a risk.
- SECURITY DEFINER foreign-id tests; `complete_leave_forwarding` PUBLIC grant must be closed or accepted.

## 5. Operational work

- Full logical dump + isolated restore gate still unresolved.
- PITR status not recorded.
- Backup and restore rehearsal must pass before production migration.
- Monitoring alerts: RLS denials, definer errors, slow query latency, connection saturation, worker failures.

## 6. Priority order

1. **Gate-first:** staging clone + backup/restore verification.
2. **Measure:** request trace + `pg_stat_statements` + synthetic load.
3. **Fix hot path:** N+1 attendance RPC.
4. **Caching discipline:** user-scoped auth context only; no cross-tenant cache.
5. **Indexes only from evidence**, including write overhead comparison.
6. **5M runtime security** before any activation.
7. **5N/5O** only after above gates.
