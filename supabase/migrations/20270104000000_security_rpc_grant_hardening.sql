-- Security: revoke anon/PUBLIC EXECUTE on SECURITY DEFINER RPCs (Phase 2).
-- =====================================================================
-- Advisor finding: anon_security_definer_function_executable (WARN, 34).
-- Each of the 34 functions was inspected individually (2026-11-06):
-- - 25 contain a direct auth.uid() check; the grant removal is
--   defense-in-depth, behavior for authenticated callers is unchanged.
-- - can_review_leave_request / session_checkin_summary delegate to
--   auth-checking helpers (can_manage_class / can_view_session).
-- - list_classes / list_published_semantics are intentionally public
--   (browse active classes / published semesters) and KEEP anon EXECUTE.
-- - Trigger functions (enforce_class_admin_cap,
--   enroll_members_on_class_join, enroll_members_on_subject_create,
--   notify_platform_admins_public_assignment) cannot be invoked via RPC
--   (no trigger context) but should not be callable at all.
-- - rls_auto_enable (event-trigger helper running dynamic DDL) must
--   never be callable by anon/authenticated. It is a production-only object
--   (see docs/architecture/phase-4c/02-current-state-architecture.md §15);
--   the revoke below is conditional so this migration applies to a fresh
--   database that does not have it.
-- - consume_rate_limit: anon could burn arbitrary rate-limit keys.
--
-- Rollback: re-grant EXECUTE ON FUNCTION ... TO anon for the function.
-- Backward compatibility: all app call sites send a JWT (authenticated);
-- service_role grants are preserved everywhere.

REVOKE EXECUTE ON FUNCTION public.accept_pending_invitation(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.add_leave_request_evidence(
  uuid, text, text, text, integer
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.become_class_representative(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.can_review_leave_request(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.can_view_leave_request(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.can_view_session(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.complete_leave_forwarding(
  uuid, uuid[], text, text, text, text, text
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.confirm_leave_request_ocr(uuid, jsonb)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_class_subject(
  uuid, text, text, text, text
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_leave_request(
  uuid, date, date, text, text, date
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.decline_class_invitation(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.delete_class_subject(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.delete_native_push_token(text)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.enforce_class_admin_cap()
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.enroll_members_on_class_join()
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.enroll_members_on_subject_create()
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_invitation_preview(text)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.is_leave_request_owner(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.list_course_component_grades(uuid, uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.list_discussion_sessions(
  uuid, text, text, timestamptz, timestamptz, integer, integer
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.notify_platform_admins_public_assignment()
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.record_leave_request_ocr(
  uuid, text, text, jsonb
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.register_native_push_token(text, text, text)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.remove_leave_request_evidence(uuid)
  FROM anon, PUBLIC;

-- Production-only object; absent on a fresh database. Revoke only when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND p.pronargs = 0
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, PUBLIC';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.session_checkin_summary(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.set_course_component_grade(
  uuid, uuid, uuid, text, numeric
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.submit_class_assignment(
  uuid, text, text, timestamptz, text, text[], jsonb, text, text, text, uuid
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.submit_leave_request(uuid)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_class_subject(
  uuid, text, text, text, text, text
) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_leave_request(
  uuid, date, date, text, text, date
) FROM anon, PUBLIC;
