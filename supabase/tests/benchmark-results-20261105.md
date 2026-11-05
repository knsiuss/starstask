# Database benchmark — 2026-11-05 (production, read-only)

Method: `EXPLAIN (ANALYZE, BUFFERS)` via `supabase db query --linked`
against production `starstask`. First call per function is reported as
cold, second as warm. No rows were written; `EXPLAIN ANALYZE` only reads.

Caveat: production data is tiny (e.g. `class_members` 34 live rows,
`assignments` 5, `course_materials` 1). Plans that show a seq scan at
n=1 are the planner choosing correctly at that size; index benefits
only appear as tables grow. Absolute numbers below therefore measure
overhead and plan shape, not load-scale throughput.

## Results

| Query / RPC                                  | Cold     | Warm                           | Notes                                                                           |
| -------------------------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `list_published_semesters()`                 | 70.2 ms  | 2.0 ms                         | 1 row, 568 buffers                                                              |
| `get_class_action_counts(synthetic class)`   | 102.8 ms | 5.7 ms                         | 0 rows: caller is not an admin, authorization filter works                      |
| `course_materials` list shape                | —        | 0.14 ms exec / 5.3 ms planning | Seq scan expected at 1 row; new composite index will be picked up at volume     |
| `developer_class_metrics(200)`               | 80.7 ms  | 16.2 ms                        | 2 classes, 2157 buffers; grouped aggregates scan all count tables               |
| `class_invitation_acceptances` user lookup   | —        | 0.14 ms exec / 3.9 ms planning | **Index Only Scan** on new `..._user_invitation_idx`, 0 heap fetches            |
| `notification_events` inbox shape (LIMIT 21) | —        | 1.4 ms exec / 11.9 ms planning | Bitmap scan on `notification_events_user_recent_idx` + sort; planning dominates |
| `developer_list_users(page 1)`               | 46.3 ms  | 3.1 ms                         | 25 rows returned                                                                |

## Findings

1. **First-call cost is 40–100 ms, warm cost is 2–16 ms.** The gap is
   function/plan warmup on a small compute tier, not data volume. Anything
   user-facing should be measured p95 over many calls, not a single cold
   call.
2. **Planning time dominates execution** on RLS-protected list queries
   (3–12 ms planning vs <2 ms execution). This is the RLS predicate
   complexity flagged in `docs/PERFORMANCE-AUDIT.md` (B5). It only matters
   if request volume grows; at current traffic it is noise.
3. **New indexes are in use where the planner can choose them:**
   invitation acceptances already shows an Index Only Scan.
   `course_materials` still seq-scans because the table has 1 row.
4. **Authorization holds:** the grouped action-count RPC returned 0 rows
   for a synthetic non-admin caller instead of leaking counts.
5. **Not measured:** old-vs-new for `notify_session_participants`
   (the loop version was replaced in migration `20261135000000` and no
   longer exists to compare), load-scale throughput, and p95 under
   concurrent traffic. Those need the local/staging stack
   (`apps/web/tests/perf/load-harness.mjs`), which requires Docker;
   the daemon was not running during this benchmark.

## Reproduce

```powershell
supabase db query --linked --yes "SET ROLE authenticated; SET request.jwt.claim.sub = '<user-uuid>'; EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.list_published_semesters();"
supabase db query --linked --yes "SET ROLE service_role; EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.developer_class_metrics(200);"
```

Use a real admin user id for `get_class_action_counts` to measure the
non-empty path; the synthetic id above only proves the deny path.
