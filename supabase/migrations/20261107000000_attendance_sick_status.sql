-- Attendance Sheet: add the stored status `sick` (code S).
--
-- The sheet needs five recorded statuses (present/late/excused/sick/absent).
-- `sick` is a stored value like the other four, so the CHECK constraints, the
-- three write-path guards, and the meeting-list counts must learn it. The
-- other summary functions count via `user_id IS NULL` for unrecorded, so a
-- sick row is correctly *not* unrecorded there; only the sheet-facing
-- meeting list needs a dedicated `sick_count` column.
-- 1. Stored-status CHECK constraints.
ALTER TABLE public.discussion_session_checkins
DROP CONSTRAINT IF EXISTS discussion_session_checkins_status_allowed;


ALTER TABLE public.discussion_session_checkins
ADD CONSTRAINT discussion_session_checkins_status_allowed CHECK (status IN ('present', 'late', 'excused', 'sick', 'absent'));


ALTER TABLE public.attendance_correction_audits
DROP CONSTRAINT IF EXISTS attendance_correction_audits_new_status;


ALTER TABLE public.attendance_correction_audits
ADD CONSTRAINT attendance_correction_audits_new_status CHECK (
  new_status IN ('present', 'late', 'excused', 'sick', 'absent')
);


ALTER TABLE public.attendance_correction_audits
DROP CONSTRAINT IF EXISTS attendance_correction_audits_previous_status;


ALTER TABLE public.attendance_correction_audits
ADD CONSTRAINT attendance_correction_audits_previous_status CHECK (
  previous_status IN (
    'present',
    'late',
    'excused',
    'sick',
    'absent',
    'not_recorded'
  )
);


-- 2. Write-path guards. The guard is a single `NOT IN (...)` list in each
-- function; re-apply the live definition with `sick` added so the rest of
-- the body (auth, window, audit) stays exactly as deployed.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'record_attendance_correction'
    AND n.nspname = 'public';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'record_attendance_correction not found';
  END IF;

  v_def := replace(
    v_def,
    'p_status not in (''present'', ''late'', ''excused'', ''absent'')',
    'p_status not in (''present'', ''late'', ''excused'', ''sick'', ''absent'')'
  );

  EXECUTE v_def;
END;
$$;


DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'review_discussion_session_checkin'
    AND n.nspname = 'public';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'review_discussion_session_checkin not found';
  END IF;

  v_def := replace(
    v_def,
    'p_status not in (''present'', ''late'', ''excused'', ''absent'')',
    'p_status not in (''present'', ''late'', ''excused'', ''sick'', ''absent'')'
  );

  EXECUTE v_def;
END;
$$;


DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'record_discussion_session_checkin'
    AND n.nspname = 'public';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'record_discussion_session_checkin not found';
  END IF;

  v_def := replace(
    v_def,
    'p_status not in (''present'', ''late'', ''excused'', ''absent'')',
    'p_status not in (''present'', ''late'', ''excused'', ''sick'', ''absent'')'
  );

  EXECUTE v_def;
END;
$$;


-- 3. Meeting list: expose `sick_count` and keep `not_recorded_count` meaning
-- "no row at all". Adding a column changes the return type, so drop first.
-- Body is the live one from 20261102130000_repair_attendance_meeting_list,
-- plus the sick filter.
DROP FUNCTION IF EXISTS public.class_attendance_meeting_list (uuid);


CREATE FUNCTION public.class_attendance_meeting_list (p_class_id uuid) returns TABLE (
  session_id uuid,
  subject_id uuid,
  subject_name text,
  subject_code text,
  meeting_number integer,
  meeting_date date,
  title text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  attendance_opens_at timestamptz,
  attendance_closes_at timestamptz,
  attendance_opened_at timestamptz,
  attendance_closed_at timestamptz,
  attendance_finalized_at timestamptz,
  radius_m integer,
  late_after_minutes integer,
  expected_count integer,
  present_count integer,
  late_count integer,
  excused_count integer,
  sick_count integer,
  absent_count integer,
  not_recorded_count integer,
  failed_count integer
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if not public.can_manage_class (p_class_id) then
    raise exception 'Not allowed to view attendance meetings' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.subject_id,
    sub.name,
    sub.code,
    s.meeting_number,
    s.meeting_date,
    s.title,
    s.location,
    s.starts_at,
    s.ends_at,
    s.attendance_opens_at,
    s.attendance_closes_at,
    s.attendance_opened_at,
    s.attendance_closed_at,
    s.attendance_finalized_at,
    s.checkin_radius_m,
    s.late_after_minutes,
    coalesce(t.expected, 0)::integer,
    coalesce(t.present_count, 0)::integer,
    coalesce(t.late_count, 0)::integer,
    coalesce(t.excused_count, 0)::integer,
    coalesce(t.sick_count, 0)::integer,
    coalesce(t.absent_count, 0)::integer,
    greatest(coalesce(t.expected, 0) - coalesce(t.present_count, 0) - coalesce(t.late_count, 0) - coalesce(t.excused_count, 0) - coalesce(t.sick_count, 0) - coalesce(t.absent_count, 0), 0)::integer,
    coalesce(f.failed_count, 0)::integer
  from
    public.discussion_sessions s
    join public.class_subjects sub on sub.id = s.subject_id
    left join lateral (
      select
        count(*) as expected,
        count(*) filter (where c.status = 'present') as present_count,
        count(*) filter (where c.status = 'late') as late_count,
        count(*) filter (where c.status = 'excused') as excused_count,
        count(*) filter (where c.status = 'sick') as sick_count,
        count(*) filter (where c.status = 'absent') as absent_count
      from
        public.class_members cm
        left join public.discussion_session_checkins c on c.session_id = s.id
        and c.user_id = cm.user_id
      where
        cm.class_id = s.class_id
        and cm.joined_at <= s.starts_at
    ) t on true
    left join lateral (
      select
        count(distinct a.user_id) as failed_count
      from
        public.attendance_verification_attempts a
      where
        a.session_id = s.id
        and a.outcome not in ('checked_in', 'already_checked_in')
    ) f on true
  where
    s.class_id = p_class_id
    and s.meeting_number is not null
    and s.status <> 'cancelled'
  order by
    s.meeting_number desc;
end;
$$;


REVOKE ALL ON function public.class_attendance_meeting_list (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.class_attendance_meeting_list (uuid) TO authenticated;


COMMENT ON function public.class_attendance_meeting_list (uuid) IS 'Attendance meetings for one class with live counts (including sick) and failed verification attempts. Class managers only.';
