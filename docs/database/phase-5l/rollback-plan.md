# Phase 5L — Rollback Plan

## Rollback for `20261119000000_phase5l_security_hardening.sql`

No data was modified by this migration (grants + policies + trigger +
search_path only), so rollback is grants/policies only — it never
touches rows. Apply in order:

```sql
-- 1. Restore anon EXECUTE (default-privilege position; re-exposes the
--    original HIGH finding — roll back only for incident recovery).
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- 2. Restore course_invite_tokens member-read policy.
DROP POLICY IF EXISTS course_invite_tokens_admin_read ON public.course_invite_tokens;

CREATE POLICY course_invite_tokens_member_read ON public.course_invite_tokens FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );

-- 3. Drop audit trigger.
DROP TRIGGER IF EXISTS audit_logs_prevent_mutation_trg ON public.audit_logs;

DROP FUNCTION IF EXISTS public.audit_logs_prevent_mutation ();

-- 4. Re-grant audit_logs (column SELECT + service-role defaults restored
--    by re-applying migration 20261029001200 grants — simplest: re-run
--    the two statements below).
GRANT
SELECT
  (
    id,
    actor_id,
    action,
    entity_type,
    entity_id,
    class_id,
    metadata,
    created_at
  ) ON public.audit_logs TO authenticated;

-- 5. Restore search_path for hardened functions (only if a hardening
--    regression is confirmed). The function list is derivable from
--    pg_proc where proconfig contains search_path="" added by this
--    migration. Each ALTER must name the exact overload; use pg_get_
--    function_identity_arguments to enumerate.
```

After rollback, re-run `supabase/tests/phase5l-grants-validation.sql`
§1 to confirm the original grant posture (expect violations > 0).

## Abort criteria (do not promote if any is true)

- Any anon-on-write-RPC violation > 0 in `phase5l-grants-validation.sql`.
- Any tenant-isolation test (T1–T9) fails.
- `pnpm test` / `tsc` regressions appear on the promotion branch.
- Staging migration apply fails or post-migration smoke tests fail.

## Promotion sequence

1. Merge the branch containing this migration + tests + docs.
2. Apply `20261119000000` to staging via the migration pipeline.
3. Run validation scripts + post-migration smoke tests on staging.
4. Run the two-university synthetic negative test on staging
   (non-member = 0 rows).
5. Request explicit production approval before applying to production.
