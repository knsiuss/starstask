-- Student-facing copy: do not disclose distance or radius on a failed
-- check-in. Students get a plain "go to your class" instruction; the exact
-- distance is still logged server-side for dispute review.
--
-- The meeting function builds its too-far message with format(); replace
-- that expression in the live body. The legacy session function raises
-- SS105, whose mapped copy lives in the web layer.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_attendance_meeting'
    AND n.nspname = 'public'
    AND p.pronargs = 6;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'check_in_attendance_meeting not found';
  END IF;

  v_def := replace(
    v_def,
    E'      ''message'', format(\n        ''You are %s m from the meeting point. The allowed radius is %s m.'',\n        round(v_distance)::integer,\n        v_session.checkin_radius_m\n      ),',
    E'      ''message'', ''Please go to your class meeting point and try again.'','
  );

  EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_attendance_meeting'
    AND n.nspname = 'public'
    AND p.pronargs = 6;

  IF v_def NOT LIKE '%Please go to your class meeting point%' THEN
    RAISE EXCEPTION 'check_in_attendance_meeting message patch did not apply';
  END IF;
END;
$$;
