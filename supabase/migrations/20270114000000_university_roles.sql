-- University roles: lecturer + university_admin (EU-LMS flavored, tenant scoped).
-- =====================================================================
-- A per-university persona role lives on university_memberships.role (ADR-001
-- one global account, many personas). Values:
--   student          default persona (unchanged behavior)
--   lecturer         verified teaching persona; may create classes directly
--                    (create_class_as_lecturer) and manage them as class admin
--   university_admin tenant-scoped administrator; may promote/demote lecturers
--                    inside THEIR OWN university only
-- Platform admins keep the global override everywhere.
--
-- Class-scoped capability enforcement is deliberately NOT here: lecturers
-- create classes, land in class_admins (exactly like an approved class
-- application), and everything downstream passes through can_manage_class(),
-- which remains the single source of truth for class capabilities.
--
-- Rollback: restore get_workspace_context from 20261158000000; restore
-- notification_events_kind_allowed from 20261147000000; drop the two
-- functions; drop the role CHECK; restore class_members/class_memberships
-- joined_via CHECKs.
-- =====================================================================
-- A role CHECK was considered and dropped: the production/staging memberships
-- already carry the 2026-11-05 `admin` value that must not be rejected.
-- Roles stay extensible (1-40 chars); callers gate on status='active' and the
-- predicate functions below, never on an exhaustive value list.
COMMENT ON COLUMN public.university_memberships.role IS 'Membership role. Extensible (student (default), lecturer, university_admin are the canonical values; legacy admin is treated as university_admin by the predicates in this migration and is not written by new code). Lecturer/university_admin grants nothing outside their own university; class capability comes from class_admins via can_manage_class().';


ALTER TABLE public.class_members
DROP CONSTRAINT IF EXISTS class_members_joined_via_allowed;


ALTER TABLE public.class_members
ADD CONSTRAINT class_members_joined_via_allowed CHECK (
  joined_via IN (
    'invitation',
    'admin_assignment',
    'platform_assignment',
    'lecturer_assignment'
  )
);


ALTER TABLE public.class_memberships
DROP CONSTRAINT IF EXISTS class_memberships_joined_via_allowed;


ALTER TABLE public.class_memberships
ADD CONSTRAINT class_memberships_joined_via_allowed CHECK (
  joined_via IN (
    'invitation',
    'admin_assignment',
    'platform_assignment',
    'transfer',
    'home_class',
    'lecturer_assignment'
  )
);


-- ---------------------------------------------------------------------------
-- Predicates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_university_admin (p_university_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.university_memberships m
    WHERE m.university_id = p_university_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('university_admin', 'admin')
  );
$$;


REVOKE ALL ON FUNCTION public.is_university_admin (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.is_university_admin (uuid) TO authenticated;


COMMENT ON FUNCTION public.is_university_admin (uuid) IS 'True when the caller is an active university_admin persona for the given university. Derived from auth.uid(), never from client input.';


CREATE OR REPLACE FUNCTION public.is_lecturer (p_university_id uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.university_memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('lecturer', 'university_admin', 'admin')
      AND (p_university_id IS NULL OR m.university_id = p_university_id)
  );
$$;


REVOKE ALL ON FUNCTION public.is_lecturer (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.is_lecturer (uuid) TO authenticated;


COMMENT ON FUNCTION public.is_lecturer (uuid) IS 'True when the caller holds an active lecturer (or university_admin) persona; pass p_university_id to scope to one tenant.';


-- ---------------------------------------------------------------------------
-- Notification kind: allow membership_role_updated.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_events
DROP CONSTRAINT IF EXISTS notification_events_kind_allowed;


ALTER TABLE public.notification_events
ADD CONSTRAINT notification_events_kind_allowed CHECK (
  kind IN (
    'class_application_approved',
    'class_application_rejected',
    'class_admin_assigned',
    'class_invitation',
    'assignment_approved',
    'assignment_rejected',
    'submission_received',
    'moderation_required',
    'session_updated',
    'session_cancelled',
    'session_rsvp',
    'leave_request_submitted',
    'leave_request_revision_requested',
    'leave_request_forwarded',
    'leave_request_approved',
    'leave_request_rejected',
    'leave_request_cancelled',
    'verification_submitted',
    'verification_approved',
    'verification_rejected',
    'verification_revision_requested',
    'class_admin_revoked',
    'class_assignment_published',
    'assignment_report_reviewed',
    'assignment_created',
    'dm_message',
    'membership_role_updated'
  )
);


-- ---------------------------------------------------------------------------
-- get_workspace_context(): add lecturer_anywhere + university_admin_universities.
-- Everything else is byte-compatible with 20261158000000.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_workspace_context () RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile jsonb;
  v_platform_admin boolean := false;
  v_class_admin boolean := false;
  v_unread integer := 0;
  v_beta boolean := false;
  v_lecturer_anywhere boolean := false;
  v_admin_universities uuid[] := ARRAY[]::uuid[];
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

  SELECT
    EXISTS (
      SELECT 1 FROM public.university_memberships m
      WHERE m.user_id = v_user_id
        AND m.status = 'active'
        AND m.role IN ('lecturer', 'university_admin', 'admin')
    ),
    COALESCE(
      array_agg(m.university_id) FILTER (
        WHERE m.role IN ('university_admin', 'admin')
      ),
      ARRAY[]::uuid[]
    )
  INTO v_lecturer_anywhere, v_admin_universities
  FROM public.university_memberships m
  WHERE m.user_id = v_user_id
    AND m.status = 'active';

  RETURN jsonb_build_object(
    'profile', v_profile,
    'platform_admin', v_platform_admin,
    'class_admin_anywhere', v_class_admin,
    'unread_notifications', v_unread,
    'beta_tester', v_beta,
    'lecturer_anywhere', v_lecturer_anywhere,
    'university_admin_universities', COALESCE(v_admin_universities, ARRAY[]::uuid[])
  );
END;
$$;
