-- Re-apply the corrected `class_attendance_meeting_list`.
--
-- `20261101090000_attendance_meetings.sql` was applied to the hosted project
-- from an earlier revision of that file, in which the count columns were
-- returned as `bigint` while the function declares `integer`. Because the
-- migration version was already recorded, later `db push` runs skipped the
-- corrected file and the hosted database kept answering 42804 ("structure of
-- query does not match function result type"). Every class attendance page
-- failed on it.
--
-- A new forward migration is the only way to replace the recorded definition
-- without rewriting migration history. The body below is the corrected one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_attendance_meeting_list (p_class_id uuid) returns TABLE (
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
    coalesce(t.absent_count, 0)::integer,
    greatest(coalesce(t.expected, 0) - coalesce(t.present_count, 0) - coalesce(t.late_count, 0) - coalesce(t.excused_count, 0) - coalesce(t.absent_count, 0), 0)::integer,
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


COMMENT ON function public.class_attendance_meeting_list (uuid) IS 'Attendance meetings for one class with live counts and failed verification attempts. Class managers only.';
