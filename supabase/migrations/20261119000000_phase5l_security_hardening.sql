-- Phase 5L: database security engineering & tenant isolation hardening.
--
-- Additive only. Fixes:
--  1. HIGH — default EXECUTE grants leave anon able to call ~40 state-changing
--     SECURITY DEFINER RPCs over /rest/v1/rpc. Functions check auth.uid()
--     internally, but the grants should not exist (see 20261029000800).
--     This migration revokes EXECUTE from anon on all write RPCs and on
--     read helpers that must never be anonymous. Only intentionally public
--     read helpers keep anon EXECUTE.
--  2. HIGH — course_invite_tokens_member_read allowed ANY member of a
--     university to SELECT token_hash rows. Tightened to platform admins
--     and class admins of the linked class only.
--  3. MEDIUM — audit_logs was append-only by convention (no UPDATE/DELETE
--     policy). service_role bypasses RLS, so a mutation trigger now
--     enforces append-only for every role except postgres superuser.
--  4. MEDIUM — 100+ SECURITY DEFINER functions run with
--     search_path = public, pg_temp. pg_temp in the search path allows a
--     caller to shadow objects via temp tables. This migration sets
--     search_path = '' per OID (bodies already use public-qualified
--     names; dynamic-SQL functions are detected and skipped).
--  5. LOW — is_university_member EXECUTE revoked from anon.
--
-- No business rules change. No table/column changes. No RLS policy on
-- tenant tables changes (is_university_member already requires
-- status='active', so suspended/graduated/pending members are denied).

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Intentionally public read helpers (anonymous browsing is a feature):
--  - get_invitation_preview: invitee preview link for logged-out users
--  - list_discussion_sessions, can_view_session, session_checkin_summary:
--    public discussion-session listing (RLS policy also TO anon)
--  - list_assignments, list_classes: public assignment/class browsing
--  - consume_rate_limit: anonymous rate-limit check (no auth identity)
--  - assignment_id_from_object_path + path helpers: storage RLS predicates
GRANT EXECUTE ON FUNCTION public.get_invitation_preview (text) TO anon;
GRANT EXECUTE ON FUNCTION public.list_discussion_sessions (uuid, text, text, timestamptz, timestamptz, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.can_view_session (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.session_checkin_summary (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.list_assignments (text, uuid, text, text, text, text, integer, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.list_classes (text, text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit (text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.assignment_id_from_object_path (text) TO anon;
GRANT EXECUTE ON FUNCTION public.leave_request_id_from_object_path (text) TO anon;
GRANT EXECUTE ON FUNCTION public.verification_request_id_from_object_path (text) TO anon;

-- Predicate helpers used inside RLS policies must stay EXECUTE-able by
-- authenticated (they were already granted); anon no longer needs them
-- except where the policy itself runs as anon (can_view_session above).

-- ---------------------------------------------------------------------------
-- 2. Tighten course_invite_tokens read policy.
--    Old: any university member could SELECT token_hash rows.
--    New: platform admin OR class admin of the linked class only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS course_invite_tokens_member_read ON public.course_invite_tokens;
DROP POLICY IF EXISTS course_invite_tokens_admin_read ON public.course_invite_tokens;

CREATE POLICY course_invite_tokens_admin_read ON public.course_invite_tokens FOR
SELECT
  TO authenticated USING (
    public.is_platform_admin ()
    OR EXISTS (
      SELECT
        1
      FROM
        public.course_offerings co
      WHERE
        co.id = course_invite_tokens.offering_id
        AND public.is_class_admin (co.class_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. audit_logs append-only trigger (enforced for every role except
--    postgres superuser, who needs recovery access).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_logs_prevent_mutation () returns trigger language plpgsql
SET
  search_path = '' AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs are append-only: UPDATE denied' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'audit_logs are append-only: DELETE denied' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.audit_logs_prevent_mutation ()
FROM
  public,
  anon,
  authenticated;

DROP TRIGGER IF EXISTS audit_logs_prevent_mutation_trg ON public.audit_logs;

CREATE TRIGGER audit_logs_prevent_mutation_trg
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_logs_prevent_mutation ();

-- Explicit column grants: authenticated may SELECT the non-sensitive
-- columns only; write grants are intentionally absent.
REVOKE ALL ON public.audit_logs
FROM
  anon,
  authenticated;

GRANT
SELECT
  (id, actor_id, action, entity_type, entity_id, class_id, university_id, metadata, created_at) ON public.audit_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Harden search_path on all SECURITY DEFINER functions that currently
--    include pg_temp. Bodies use public-qualified names, so '' is safe.
--    Dynamic-SQL functions are skipped (left at public, pg_temp).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid AS fn_oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prosrc AS body
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND array_to_string(p.proconfig, ',') LIKE '%pg_temp%'
  LOOP
    IF r.body LIKE '%EXECUTE %' OR r.body LIKE '%EXECUTE format%' THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = %L', r.proname, r.args, '');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.audit_logs_prevent_mutation () IS 'Phase 5L: enforces audit_logs append-only for all non-superuser roles.';
