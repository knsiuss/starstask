-- Check-in policy change: Present until close, and retry updates the row.
--
-- Old rule: a GPS check-in after `starts_at + late_after_minutes` (meetings)
-- or 10 minutes (legacy sessions) was recorded as `late`. New rule: every
-- check-in inside the open window is `present`; the window itself (opens at
-- starts_at - 15 min, closes at closes_at/ends_at) is the only gate. `late`
-- remains a manual/correction status an organizer can still set.
--
-- Retry: a second GPS check-in while the meeting is open now updates the
-- existing row (fresh distance, accuracy, and check-in time) instead of
-- returning the first reading forever. An organizer-reviewed manual row
-- still wins over a student retry.
--
-- Both edits patch the live function bodies in place so auth, window,
-- accuracy, identity, and audit logic stay exactly as deployed. The
-- freshness wrappers (20261106000000) delegate to these functions, so they
-- pick up the new policy without changes.
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
    E'  if found\n  and not (\n    v_checkin.method in (\'manual\', \'system\')\n    and v_checkin.reviewed_at is null\n  ) then',
    E'  if found\n  and v_checkin.method in (\'manual\', \'system\')\n  and v_checkin.reviewed_at is not null\n  then'
  );

  v_def := replace(
    v_def,
    E'  v_new_status := case\n    when now() > v_session.starts_at + make_interval (mins => v_session.late_after_minutes) then \'late\'\n    else \'present\'\n  end;',
    E'  v_new_status := \'present\';'
  );

  EXECUTE v_def;

  -- Fail loudly if a patch did not match the live body.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_attendance_meeting'
    AND n.nspname = 'public'
    AND p.pronargs = 6;

  IF v_def NOT LIKE '%v_new_status := ''present'';%'
  OR v_def LIKE '%late_after_minutes) then ''late''%' THEN
    RAISE EXCEPTION 'check_in_attendance_meeting patch did not apply';
  END IF;
END;
$$;


DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_discussion_session'
    AND n.nspname = 'public'
    AND p.pronargs = 4;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'check_in_discussion_session not found';
  END IF;

  v_def := replace(
    v_def,
    E'  if found\n  and not (v_checkin.method = \'manual\' and v_checkin.reviewed_at is null) then',
    E'  if found\n  and v_checkin.method = \'manual\'\n  and v_checkin.reviewed_at is not null\n  then'
  );

  v_def := replace(
    v_def,
    E'  v_new_status := case\n    when now() > v_starts_at + interval \'10 minutes\' then \'late\'\n    else \'present\'\n  end;',
    E'  v_new_status := \'present\';'
  );

  EXECUTE v_def;

  -- Fail loudly if a patch did not match the live body.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_discussion_session'
    AND n.nspname = 'public'
    AND p.pronargs = 4;

  IF v_def NOT LIKE '%v_new_status := ''present'';%'
  OR v_def LIKE '%interval ''10 minutes'' then ''late''%' THEN
    RAISE EXCEPTION 'check_in_discussion_session patch did not apply';
  END IF;
END;
$$;


COMMENT ON function public.check_in_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision
) IS 'Identity-verified GPS check-in for one meeting. Every check-in inside the open window records present; a retry while open updates the row. The profile name and NIM must match; distance, window, and membership are decided here.';


COMMENT ON function public.check_in_discussion_session (uuid, double precision, double precision, double precision) IS 'Records the caller at a session, after checking the window, accuracy, distance, and class membership. Every check-in inside the open window records present; a retry while open updates the row.';
