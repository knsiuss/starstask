-- =====================================================================
-- Self-service class leave + course access leave (worker-t1).
--
-- Additive only: two new SECURITY DEFINER functions, no table restructure,
-- no rename, no drop of anything existing. NOT applied to any database.
--
-- Scope is strictly self. These functions act on auth.uid() only and never
-- touch another member's rows. They intentionally do NOT change
-- `remove_class_member` (manager-only path) or `remove_class_admin`.
--
-- Behavior:
--   * leave_my_class: caller must be a class_members row. If the caller is
--     the last class_admin, the longest-tenured OTHER member (joined_at ASC,
--     tie-break user_id ASC) is auto-promoted to class_admin plus the
--     normalized RBAC dual-write (class_admin_assignments + the 8 manage_*
--     permission rows), mirroring grant_ketua_kelas / decide_class_application.
--     granted_by on the successor assignment = successor (not the leaver) to avoid 23503 when the leaving admin lacks a profiles row.
--     If no other member exists, promotion is skipped and the lone member
--     may leave (an empty class keeps zero admins until deleted).
--     class_admins row of the caller disappears via FK cascade from
--     class_members. class_admin_assignments rows for the caller are NOT
--     revoked here (legacy parity: class_members delete leaves the normalized
--     RBAC rows behind; a future cutover handles revocation).
--   * leave_my_course: caller must be a class_member with
--     course_scope = 'selected'. Deletes ONLY the caller's
--     class_member_courses row for p_subject_id. Members with scope 'all'
--     have no per-course rows and must leave the class instead.
--
-- Rollback: DROP FUNCTION leave_my_class(uuid), leave_my_course(uuid, uuid).
-- No data backfill; nothing to restore.
-- =====================================================================
-- ---------------------------------------------------------------------------
-- leave_my_class
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_my_class (p_class_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_admin_count integer;
  v_is_admin boolean;
  v_successor uuid;
  v_university uuid;
  v_assignment_id uuid;
  v_promoted uuid := NULL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members m
    WHERE m.class_id = p_class_id
      AND m.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'not a member' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_admin_count
  FROM public.class_admins ca
  WHERE ca.class_id = p_class_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.class_admins ca
    WHERE ca.class_id = p_class_id
      AND ca.user_id = v_user
  ) INTO v_is_admin;

  IF v_is_admin AND v_admin_count <= 1 THEN
    SELECT m.user_id
    INTO v_successor
    FROM public.class_members m
    WHERE m.class_id = p_class_id
      AND m.user_id <> v_user
    ORDER BY m.joined_at ASC, m.user_id ASC
    LIMIT 1;

    IF v_successor IS NULL THEN
      -- Lone member leaving an otherwise empty class. Allowed; skip promotion.
      NULL;
    ELSE
      INSERT INTO public.class_admins (class_id, user_id, assigned_by)
      VALUES (p_class_id, v_successor, v_user)
      ON CONFLICT (class_id, user_id) DO NOTHING;

      SELECT c.university_id
      INTO v_university
      FROM public.classes c
      WHERE c.id = p_class_id;

      IF v_university IS NOT NULL THEN
        INSERT INTO public.class_admin_assignments (
          university_id, class_id, user_id, granted_by
        ) VALUES (
          v_university, p_class_id, v_successor, v_successor
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_assignment_id;

        IF v_assignment_id IS NOT NULL THEN
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
          ])
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      PERFORM public.record_audit(
        'class_admin_auto_promoted',
        'class_admin',
        v_successor,
        p_class_id,
        '{"reason":"last_admin_left"}'::jsonb
      );

      v_promoted := v_successor;
    END IF;
  END IF;

  DELETE FROM public.class_members
  WHERE class_id = p_class_id
    AND user_id = v_user;

  PERFORM public.record_audit(
    'class_member_self_left',
    'class_member',
    v_user,
    p_class_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('status', 'left', 'promoted_user_id', v_promoted);
END;
$$;


REVOKE ALL ON FUNCTION public.leave_my_class (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.leave_my_class (uuid) TO authenticated;


COMMENT ON FUNCTION public.leave_my_class (uuid) IS 'Self-service class leave for the caller (auth.uid()). Auto-promotes the longest-tenured remaining member to class admin (plus normalized RBAC dual-write) when the caller is the last class admin. Self-scope only; does not change remove_class_member.';


-- ---------------------------------------------------------------------------
-- leave_my_course
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_my_course (p_class_id uuid, p_subject_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_scope text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT m.course_scope
  INTO v_scope
  FROM public.class_members m
  WHERE m.class_id = p_class_id
    AND m.user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a member' USING ERRCODE = 'P0002';
  END IF;

  IF v_scope IS DISTINCT FROM 'selected' THEN
    RAISE EXCEPTION 'course leave requires selected course access' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.class_member_courses
  WHERE class_id = p_class_id
    AND user_id = v_user
    AND subject_id = p_subject_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'course access row not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.record_audit(
    'course_access_self_left',
    'class_member_course',
    p_subject_id,
    p_class_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('status', 'left');
END;
$$;


REVOKE ALL ON FUNCTION public.leave_my_course (uuid, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.leave_my_course (uuid, uuid) TO authenticated;


COMMENT ON FUNCTION public.leave_my_course (uuid, uuid) IS 'Self-service leave from one course inside a class. Only members with course_scope = selected may use this; deletes only the caller (auth.uid()) row in class_member_courses.';
