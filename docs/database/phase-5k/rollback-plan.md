# Rollback plan — Phase 5K

> **Date:** 2026-11-05. **Purpose:** undo the `session_checkin_summary_many` optimization cleanly.
> **Production is untouched; this rollback is for the scratch/staging path.**

## 1. If the batched RPC misbehaves on staging (or before promotion)

1. **Application revert (no DB change yet):** revert the two call sites (`attendance.ts`, `attendance-meetings.ts`) back to `Promise.all(...)` calling `session_checkin_summary`. Radius fallback 150 m remains.

   ```bash
   git diff apps/web/src/lib/db/attendance.ts apps/web/src/lib/db/attendance-meetings.ts
   # then git checkout / git revert the Phase 5K commit
   ```

2. **Type rollback:** remove `session_checkin_summary_many` from `database.ts` / `database.generated.ts` (regenerate types from the DB without the function).

3. **Database rollback:** drop the new function only (no other object depends on it):

   ```sql
   DROP FUNCTION IF EXISTS public.session_checkin_summary_many(uuid[]);
   ```

   No data migration is required. No table/column/RLS change to undo.

## 2. Promotion sequence (later, after approval)

1. Freeze and re-measure `pg_stat_statements` on the staging clone (tenant A/B).
2. Run `supabase/tests/phase5k-session-checkin-summary-many-validation.sql` again in the rebuilt staging DB; check `old_rows = new_rows`, `old_only = new_only = 0`.
3. Apply `20261118000000_session_checkin_summary_many.sql` via the project's migration pipeline (do not apply by hand to production).
4. Regenerate types in CI; run targeted vitest; run a targeted staging RLS negative test (two synthetic universities, non-member = 0 rows) before opening the app path.
5. Monitor RPC error rate and `pg_stat_statements` for 24–48h.

## 3. Abort criteria

- any mismatch row (`old_only` or `new_only` > 0)
- non-member or anonymous sees rows
- RPC error rate increases above baseline
- new function appears in `information_schema` as grantable to `anon`

On any abort: apply the DB rollback above and revert the app commits.

## 4. Data integrity

- No data was written by the migration (only function definition + grant).
- No backfill, truncates, or ALTER TABLE touched production at any point.
- The quarantined `20261110000000_subject_enrollment.sql` is excluded from the plan entirely.
