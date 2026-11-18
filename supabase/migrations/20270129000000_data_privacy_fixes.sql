-- Data privacy fix: restrict list_course_component_grades to the caller's own
-- rows unless the caller can manage the class (or is running as service_role
-- for an authorized background export).
CREATE OR REPLACE FUNCTION public.list_course_component_grades (p_class_id uuid, p_subject_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid ());
  v_can_manage boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    IF current_user IN ('postgres', 'service_role') THEN
      v_can_manage := true;
    ELSE
      RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_can_manage := public.can_manage_class (p_class_id);

    IF NOT v_can_manage AND NOT EXISTS (
      SELECT
        1
      FROM
        public.class_members m
      WHERE
        m.class_id = p_class_id
        AND m.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'not a member of this class' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN coalesce(
    (
      SELECT
        jsonb_object_agg(
          g.student_id::text || ':' || g.component,
          g.score
        )
      FROM
        public.course_component_grades g
      WHERE
        g.class_id = p_class_id
        AND g.subject_id = p_subject_id
        AND (
          v_can_manage
          OR g.student_id = v_user_id
        )
    ),
    '{}'::jsonb
  );
END;
$$;
