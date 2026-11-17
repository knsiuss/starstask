-- Security: lock down 9 observability views (Phase 1).
-- =====================================================================
-- Advisor finding: security_definer_view (ERROR, 9 findings). All 9 views
-- ran with owner privileges AND anon held SELECT, so any unauthenticated
-- caller could read them via PostgREST, bypassing RLS on underlying tables.
-- Worst cases (verified live 2026-11-06):
-- - notification_daily_digest: every user's notification payloads
-- - assignments_owner_reporting: all assignments incl. unpublished rows
-- - discussion_sessions_domain_view: all sessions incl. non-public
--
-- Remediation: security_invoker=true + revoke anon/authenticated, keep
-- service_role only. These views are observability/reporting only; no
-- end-user UI selects from them (grep-verified). The only app consumers
-- (dual_write_drift, nim_drift, observability_tenant_gap) read via the
-- admin client (service_role), which bypasses RLS anyway.
--
-- Rollback: ALTER VIEW ... SET (security_invoker=false) and re-grant
-- SELECT to anon, authenticated for the affected view.
ALTER VIEW public.assignments_owner_reporting
SET
  (security_invoker = TRUE);


ALTER VIEW public.audit_logs_university_gap
SET
  (security_invoker = TRUE);


ALTER VIEW public.classes_legacy_vs_fk_gap
SET
  (security_invoker = TRUE);


ALTER VIEW public.discussion_sessions_domain_view
SET
  (security_invoker = TRUE);


ALTER VIEW public.dual_write_drift
SET
  (security_invoker = TRUE);


ALTER VIEW public.nim_drift
SET
  (security_invoker = TRUE);


ALTER VIEW public.notification_daily_digest
SET
  (security_invoker = TRUE);


ALTER VIEW public.observability_tenant_gap
SET
  (security_invoker = TRUE);


ALTER VIEW public.semester_rollover_candidates
SET
  (security_invoker = TRUE);


REVOKE ALL ON public.assignments_owner_reporting
FROM
  anon,
  authenticated;


REVOKE ALL ON public.audit_logs_university_gap
FROM
  anon,
  authenticated;


REVOKE ALL ON public.classes_legacy_vs_fk_gap
FROM
  anon,
  authenticated;


REVOKE ALL ON public.discussion_sessions_domain_view
FROM
  anon,
  authenticated;


REVOKE ALL ON public.dual_write_drift
FROM
  anon,
  authenticated;


REVOKE ALL ON public.nim_drift
FROM
  anon,
  authenticated;


REVOKE ALL ON public.notification_daily_digest
FROM
  anon,
  authenticated;


REVOKE ALL ON public.observability_tenant_gap
FROM
  anon,
  authenticated;


REVOKE ALL ON public.semester_rollover_candidates
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.assignments_owner_reporting TO service_role;


GRANT
SELECT
  ON public.audit_logs_university_gap TO service_role;


GRANT
SELECT
  ON public.classes_legacy_vs_fk_gap TO service_role;


GRANT
SELECT
  ON public.discussion_sessions_domain_view TO service_role;


GRANT
SELECT
  ON public.dual_write_drift TO service_role;


GRANT
SELECT
  ON public.nim_drift TO service_role;


GRANT
SELECT
  ON public.notification_daily_digest TO service_role;


GRANT
SELECT
  ON public.observability_tenant_gap TO service_role;


GRANT
SELECT
  ON public.semester_rollover_candidates TO service_role;
