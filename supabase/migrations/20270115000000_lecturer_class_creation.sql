-- University admin verification + lecturer direct-class creation.
-- =====================================================================
-- university admins (tenant scoped) may list and promote/demote lecturers of
-- THEIR university, never set themselves or anyone else to university_admin.
-- Only platform admins may grant/revoke the university_admin role.
--
-- Lecturers create classes directly (no approval queue). The created class
-- mirrors what decide_class_application does, minus the application row:
-- courses row, classes row (status active, university_id), class_members
-- (joined_via lecturer_assignment), class_admins, and a dual-write into the
-- normalized new-model RBAC (class_admin_assignments + class_admin_permissions,
-- all 8 manage_* codes) for forward-compat with a future cutover.
--
-- Rollback: DROP FUNCTION create_class_as_lecturer, set_university_membership_role,
-- set_university_admin_role, list_university_members; restore joined_via CHECKs
-- and notification_events_kind_allowed from 20261147000000/20270114000000.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- create_class_as_lecturer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_class_as_lecturer (
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_proposed_class_code text DEFAULT NULL,
  p_university_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_university uuid := p_university_id;
  v_slug text := lower(btrim(coalesce(p_proposed_slug, '')));
  v_code text := nullif(upper(btrim(coalesce(p_proposed_class_code, ''))), '');
  v_course_id uuid;
  v_class_id uuid;
  v_assignment_id uuid;
  v_name text := btrim(coalesce(p_proposed_name, ''));
  v_course_name text := btrim(coalesce(p_course_name, ''));
  v_semester text := btrim(coalesce(p_semester, ''));
  v_academic_year text := btrim(coalesce(p_academic_year, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_institution text := nullif(btrim(coalesce(p_institution, '')), '');
  v_lecturer text;
  v_membership_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_slug) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'invalid class slug' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_name) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'class name must be 3 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_description) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'description must be 10 to 5000 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_course_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'course name must be 2 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_semester) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'semester must be 1 to 20 characters' USING ERRCODE = '22023';
  END IF;

  IF v_academic_year !~ '^\d{4}/\d{4}$' THEN
    RAISE EXCEPTION 'academic year must look like 2026/2027' USING ERRCODE = '22023';
  END IF;

  IF v_code IS NOT NULL AND char_length(v_code) NOT BETWEEN 2 AND 20 THEN
    RAISE EXCEPTION 'class code must be 2 to 20 characters' USING ERRCODE = '22023';
  END IF;

  IF v_university IS NULL THEN
    SELECT count(*)
    INTO v_membership_count
    FROM public.university_memberships m
    WHERE m.user_id = v_user
      AND m.status = 'active'
      AND m.role IN ('lecturer', 'university_admin');

    IF v_membership_count = 0 THEN
      RAISE EXCEPTION 'lecturer or university_admin membership required' USING ERRCODE = '42501';
    ELSIF v_membership_count > 1 THEN
      RAISE EXCEPTION 'multiple university memberships; pass p_university_id' USING ERRCODE = '22023';
    END IF;

    SELECT m.university_id
    INTO v_university
    FROM public.university_memberships m
    WHERE m.user_id = v_user
      AND m.status = 'active'
      AND m.role IN ('lecturer', 'university_admin')
    LIMIT 1;
  ELSE
    IF NOT public.is_lecturer (v_university) THEN
      RAISE EXCEPTION 'lecturer or university_admin membership in that university required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT p.display_name
  INTO v_lecturer
  FROM public.profiles p
  WHERE p.id = v_user;
  v_lecturer := coalesce(nullif(btrim(coalesce(p_lecturer_name, '')), ''), v_lecturer);

  IF v_lecturer IS NULL OR char_length(v_lecturer) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'lecturer name must be 1 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.slug = v_slug
  ) THEN
    RAISE EXCEPTION 'class slug already taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.courses (name)
  VALUES (v_course_name)
  ON CONFLICT (normalized_name) DO UPDATE
  SET name = excluded.name
  RETURNING id INTO v_course_id;

  INSERT INTO public.classes (
    slug,
    name,
    description,
    course_id,
    course_name,
    institution,
    lecturer_name,
    semester,
    academic_year,
    status,
    created_by,
    university_id,
    class_code
  ) VALUES (
    v_slug,
    v_name,
    v_description,
    v_course_id,
    v_course_name,
    v_institution,
    v_lecturer,
    v_semester,
    v_academic_year,
    'active',
    v_user,
    v_university,
    v_code
  ) RETURNING id INTO v_class_id;

  INSERT INTO public.class_members (class_id, user_id, joined_via)
  VALUES (v_class_id, v_user, 'lecturer_assignment')
  ON CONFLICT (class_id, user_id) DO NOTHING;

  INSERT INTO public.class_admins (class_id, user_id, assigned_by)
  VALUES (v_class_id, v_user, v_user)
  ON CONFLICT (class_id, user_id) DO NOTHING;

  INSERT INTO public.class_admin_assignments (
    university_id, class_id, user_id, granted_by
  ) VALUES (
    v_university, v_class_id, v_user, v_user
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.class_admin_permissions (assignment_id, permission_code)
  SELECT v_assignment_id, unnest(ARRAY[
    'manage_admins',
    'manage_attendance',
    'manage_assignments',
    'manage_announcements',
    'manage_grades',
    'manage_schedule',
    'manage_materials',
    'manage_leave_review'
  ]);

  PERFORM public.record_audit(
    'class_created_by_lecturer',
    'class',
    v_class_id,
    v_class_id,
    jsonb_build_object(
      'slug', v_slug,
      'class_code', v_code,
      'university_id', v_university
    )
  );

  RETURN v_class_id;
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%classes_period_code_key%' OR SQLERRM LIKE '%period_code%' THEN
      RAISE EXCEPTION 'a class with this code already exists in the same period'
        USING ERRCODE = '23505';
    END IF;
    RAISE EXCEPTION 'class already exists' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.create_class_as_lecturer (text, text, text, text, text, text, text, text, text, uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_class_as_lecturer (text, text, text, text, text, text, text, text, text, uuid)
TO authenticated;

COMMENT ON FUNCTION public.create_class_as_lecturer (text, text, text, text, text, text, text, text, text, uuid) IS
  'Direct class creation for lecturer/university_admin personas. Bypasses the application queue; mirrors decide_class_application. Actor is auth.uid() evaluated in-function.';

-- ---------------------------------------------------------------------------
-- list_university_members: tenant-scoped, PII-light read.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_university_members (
  p_university_id uuid,
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  student_id text,
  role text,
  status text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_role text := nullif(lower(btrim(coalesce(p_role, ''))), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_platform_admin() OR public.is_university_admin (p_university_id)) THEN
    RAISE EXCEPTION 'university admin required' USING ERRCODE = '42501';
  END IF;

  IF v_role IS NOT NULL
     AND v_role NOT IN ('student', 'lecturer', 'university_admin') THEN
    RAISE EXCEPTION 'unknown role filter' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT m.id,
           m.user_id,
           p.display_name,
           p.avatar_url,
           m.student_id,
           m.role,
           m.status,
           m.created_at
    FROM public.university_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.university_id = p_university_id
      AND (
        v_search IS NULL
        OR p.display_name ILIKE '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR m.student_id ILIKE '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
      AND (v_role IS NULL OR m.role = v_role)
  ),
  counted AS (
    SELECT count(*) AS total_count FROM scoped
  )
  SELECT s.id,
         s.user_id,
         s.display_name,
         s.avatar_url,
         s.student_id,
         s.role,
         s.status,
         s.created_at,
         c.total_count
  FROM counted c
  CROSS JOIN LATERAL (
    SELECT *
    FROM scoped
    ORDER BY scoped.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) s;
END;
$$;

REVOKE ALL ON FUNCTION public.list_university_members (uuid, text, text, integer, integer)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_university_members (uuid, text, text, integer, integer)
TO authenticated;

COMMENT ON FUNCTION public.list_university_members (uuid, text, text, integer, integer) IS
  'Tenant-scoped member list for university admins. Never returns emails; display name, student id, role, status only. total_count is a window count over the filtered set.';

-- ---------------------------------------------------------------------------
-- set_university_member_role: promote/demote student <-> lecturer (+ explicit
-- university_admin by platform admin or another university_admin of the same tenant).
-- Anti-self-elevation: a caller cannot change their own row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_university_member_role (
  p_university_id uuid,
  p_user_id uuid,
  p_role text,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_membership public.university_memberships;
  v_old_role text;
  v_new_role text := lower(btrim(coalesce(p_role, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_membership_id uuid;
  v_is_platform boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_new_role NOT IN ('student', 'lecturer', 'university_admin') THEN
    RAISE EXCEPTION 'unknown role' USING ERRCODE = '22023';
  END IF;

  v_is_platform := public.is_platform_admin();

  IF NOT (
    v_is_platform
    OR public.is_university_admin (p_university_id)
  ) THEN
    RAISE EXCEPTION 'university admin required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_caller AND NOT v_is_platform THEN
    RAISE EXCEPTION 'cannot change your own role' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_membership
  FROM public.university_memberships m
  WHERE m.user_id = p_user_id
    AND m.university_id = p_university_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_membership.status <> 'active' THEN
    RAISE EXCEPTION 'only active memberships can change role' USING ERRCODE = '22023';
  END IF;

  v_old_role := v_membership.role;

  IF NOT v_is_platform THEN
    IF v_old_role = 'university_admin' THEN
      RAISE EXCEPTION 'only a platform admin may change a university admin' USING ERRCODE = '42501';
    END IF;
    IF v_new_role NOT IN ('student', 'lecturer') THEN
      RAISE EXCEPTION 'only platform admins may grant or revoke university_admin' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_old_role = v_new_role THEN
    RETURN v_membership.id;
  END IF;

  UPDATE public.university_memberships
  SET role = v_new_role
  WHERE id = v_membership.id
  RETURNING id INTO v_membership_id;

  PERFORM public.record_audit(
    'university_membership_role_updated',
    'university_membership',
    v_membership_id,
    NULL,
    jsonb_build_object(
      'university_id', p_university_id,
      'from', v_old_role,
      'to', v_new_role,
      'reason', v_reason
    )
  );

  PERFORM public.enqueue_notification_event(
    p_user_id,
    'membership_role_updated',
    'membership_role:' || v_membership_id || ':' || v_new_role,
    jsonb_build_object(
      'title', 'Peran kamu di universitas diperbarui',
      'body', 'Perannya berubah dari ' || v_old_role || ' menjadi ' || v_new_role || '.',
      'url', '/university'
    )
  );

  RETURN v_membership_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'role update conflicted with another transaction' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.set_university_member_role (uuid, uuid, text, text)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_university_member_role (uuid, uuid, text, text)
TO authenticated;

COMMENT ON FUNCTION public.set_university_member_role (uuid, uuid, text, text) IS
  'Promote/demote member role. University admins scope to their own university; platform admins are unscoped. No caller may change their own membership row.';
