-- Allow permanent deletion of an empty class that has no academic history
-- and at most 1 member (the creator/solo admin), regardless of whether it is
-- draft or active.
CREATE OR REPLACE FUNCTION public.get_class_dependencies (p_class_id uuid) RETURNS TABLE (
  class_status text,
  member_count bigint,
  assignment_count bigint,
  submission_count bigint,
  session_count bigint,
  attendance_count bigint,
  schedule_count bigint,
  calendar_event_count bigint,
  leave_request_count bigint,
  subject_count bigint,
  invitation_count bigint,
  has_history boolean,
  can_delete boolean
) LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_class public.classes;
  v_members bigint;
  v_assignments bigint;
  v_submissions bigint;
  v_sessions bigint;
  v_attendance bigint;
  v_schedules bigint;
  v_events bigint;
  v_leave bigint;
  v_subjects bigint;
  v_invitations bigint;
  v_has_academic boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.can_manage_class(p_class_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'class manager required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_class
  FROM public.classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_members FROM public.class_members WHERE class_id = p_class_id;
  SELECT count(*) INTO v_assignments FROM public.assignments WHERE class_id = p_class_id;
  SELECT count(DISTINCT r.assignment_id) INTO v_submissions
  FROM public.assignment_reviews r
  JOIN public.assignments a ON a.id = r.assignment_id
  WHERE a.class_id = p_class_id;
  SELECT count(*) INTO v_sessions FROM public.discussion_sessions WHERE class_id = p_class_id;
  SELECT count(*) INTO v_attendance
  FROM public.discussion_session_checkins c
  JOIN public.discussion_sessions s ON s.id = c.session_id
  WHERE s.class_id = p_class_id;
  SELECT count(*) INTO v_schedules FROM public.class_course_schedules WHERE class_id = p_class_id;
  SELECT count(*) INTO v_events FROM public.class_calendar_events WHERE class_id = p_class_id;
  SELECT count(*) INTO v_leave FROM public.leave_requests WHERE class_id = p_class_id;
  SELECT count(*) INTO v_subjects FROM public.class_subjects WHERE class_id = p_class_id;
  SELECT count(*) INTO v_invitations FROM public.class_invitations WHERE class_id = p_class_id;

  v_has_academic := (
    v_assignments + v_submissions + v_sessions + v_attendance + v_leave
  ) > 0;

  RETURN QUERY
  SELECT
    v_class.status,
    v_members,
    v_assignments,
    v_submissions,
    v_sessions,
    v_attendance,
    v_schedules,
    v_events,
    v_leave,
    v_subjects,
    v_invitations,
    v_has_academic,
    (NOT v_has_academic AND v_members <= 1);
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_class (p_class_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_class public.classes;
  v_members bigint;
  v_assignments bigint;
  v_submissions bigint;
  v_sessions bigint;
  v_attendance bigint;
  v_schedules bigint;
  v_events bigint;
  v_leave bigint;
  v_has_academic boolean;
  v_can_delete boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_class(p_class_id) THEN
    RAISE EXCEPTION 'class manager required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_class
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_members FROM public.class_members WHERE class_id = p_class_id;
  SELECT count(*) INTO v_assignments FROM public.assignments WHERE class_id = p_class_id;
  SELECT count(DISTINCT r.assignment_id) INTO v_submissions
  FROM public.assignment_reviews r
  JOIN public.assignments a ON a.id = r.assignment_id
  WHERE a.class_id = p_class_id;
  SELECT count(*) INTO v_sessions FROM public.discussion_sessions WHERE class_id = p_class_id;
  SELECT count(*) INTO v_attendance
  FROM public.discussion_session_checkins c
  JOIN public.discussion_sessions s ON s.id = c.session_id
  WHERE s.class_id = p_class_id;
  SELECT count(*) INTO v_schedules FROM public.class_course_schedules WHERE class_id = p_class_id;
  SELECT count(*) INTO v_events FROM public.class_calendar_events WHERE class_id = p_class_id;
  SELECT count(*) INTO v_leave FROM public.leave_requests WHERE class_id = p_class_id;

  v_has_academic := (
    v_assignments + v_submissions + v_sessions + v_attendance + v_leave
  ) > 0;
  v_can_delete := NOT v_has_academic AND v_members <= 1;

  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'class has related records; archive it instead' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.record_audit(
    'class_deleted',
    'class',
    p_class_id,
    NULL,
    jsonb_build_object(
      'slug', v_class.slug,
      'name', v_class.name,
      'class_code', v_class.class_code,
      'academic_year', v_class.academic_year,
      'semester', v_class.semester,
      'status', v_class.status,
      'members', v_members,
      'assignments', v_assignments,
      'submissions', v_submissions,
      'sessions', v_sessions,
      'attendance', v_attendance,
      'schedules', v_schedules,
      'leave_requests', v_leave
    )
  );

  DELETE FROM public.classes WHERE id = p_class_id;

  RETURN TRUE;
END;
$$;
