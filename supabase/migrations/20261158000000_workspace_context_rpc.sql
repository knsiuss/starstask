-- Workspace context RPC: 6 layout roundtrips -> 1.
-- =====================================================================
-- WorkspaceLayout resolved session profile, platform-admin flag,
-- class-admin flag, unread notification count, own profile and beta
-- status with six separate queries on every navigation. Each query is
-- a separate PostgREST/Auth roundtrip, so navigation paid ~6x network
-- latency before rendering anything. This RPC returns the same fields
-- in one call, following the get_dashboard_overview pattern.
--
-- The caller identity comes from auth.uid() (never a client-supplied
-- user id). Fields mirror lib/db lookups:
-- - profile: id, display_name, avatar_url, onboarded_at from profiles
-- - platform_admin: exists in platform_admins
-- - class_admin_anywhere: exists in class_admins for the caller
-- - unread_notifications: count of unread notification_events rows
-- - beta_tester: exists in beta_testers
--
-- Rollback: DROP FUNCTION public.get_workspace_context();
-- Code falls back to the legacy multi-query path on error.

CREATE OR REPLACE FUNCTION public.get_workspace_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile jsonb;
  v_platform_admin boolean := false;
  v_class_admin boolean := false;
  v_unread integer := 0;
  v_beta boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'display_name', display_name,
    'avatar_url', avatar_url,
    'onboarded_at', onboarded_at
  )
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = v_user_id
  ) INTO v_platform_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.class_admins WHERE user_id = v_user_id
  ) INTO v_class_admin;

  SELECT count(*)
  INTO v_unread
  FROM public.notification_events
  WHERE user_id = v_user_id
    AND read_at IS NULL;

  SELECT EXISTS (
    SELECT 1 FROM public.beta_testers WHERE user_id = v_user_id
  ) INTO v_beta;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'platform_admin', v_platform_admin,
    'class_admin_anywhere', v_class_admin,
    'unread_notifications', v_unread,
    'beta_tester', v_beta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_context()
FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_workspace_context()
TO authenticated;

COMMENT ON FUNCTION public.get_workspace_context() IS 'Workspace layout context in 1 roundtrip: profile, admin flags, unread count, beta status. Mirrors WorkspaceLayout lookups.';
