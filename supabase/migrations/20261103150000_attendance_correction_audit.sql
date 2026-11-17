-- Attendance correction audit and the radius cap.
--
-- Manual correction is an administrative exception, never a geofence bypass:
-- the RPC below refuses to mark a member present/late without an explicit
-- physical-verification attestation, and writes an append-only audit row in
-- the same transaction. The audit table has no client write path at all;
-- class managers may read it for exports and review.
--
-- The 25..500 m radius cap replaces the historical 25..1000 m bound in the
-- three location-setting functions. Existing rows are never rewritten.
-- ---------------------------------------------------------------------------
-- Correction audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_correction_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.discussion_sessions (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.class_subjects (id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  admin_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  reason text NOT NULL,
  physically_verified boolean NOT NULL DEFAULT FALSE,
  verification_method text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_correction_audits_new_status CHECK (new_status IN ('present', 'late', 'excused', 'absent')),
  CONSTRAINT attendance_correction_audits_previous_status CHECK (
    previous_status IN ('present', 'late', 'excused', 'absent', 'not_recorded')
  ),
  CONSTRAINT attendance_correction_audits_reason CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  CONSTRAINT attendance_correction_audits_method CHECK (verification_method IN ('manual', 'physical')),
  CONSTRAINT attendance_correction_audits_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);


COMMENT ON TABLE public.attendance_correction_audits IS 'Append-only record of every manual attendance correction. Written only by record_attendance_correction(); students cannot see or change it.';


CREATE INDEX IF NOT EXISTS attendance_correction_audits_session_idx ON public.attendance_correction_audits (session_id, created_at DESC);


CREATE INDEX IF NOT EXISTS attendance_correction_audits_class_subject_idx ON public.attendance_correction_audits (class_id, subject_id, created_at DESC);


CREATE INDEX IF NOT EXISTS attendance_correction_audits_student_idx ON public.attendance_correction_audits (student_id, created_at DESC);


ALTER TABLE public.attendance_correction_audits ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.attendance_correction_audits
FROM
  anon,
  authenticated;


DROP POLICY IF EXISTS attendance_correction_audits_manager_read ON public.attendance_correction_audits;


CREATE POLICY attendance_correction_audits_manager_read ON public.attendance_correction_audits FOR
SELECT
  TO authenticated USING (public.can_manage_class (class_id));


GRANT
SELECT
  ON public.attendance_correction_audits TO authenticated;


-- ---------------------------------------------------------------------------
-- record_attendance_correction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_correction (
  p_session_id uuid,
  p_user_id uuid,
  p_status text,
  p_reason text,
  p_physically_verified boolean DEFAULT FALSE
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_admin uuid := auth.uid ();
  v_session public.discussion_sessions %rowtype;
  v_joined_at timestamptz;
  v_note text := nullif(btrim(coalesce(p_reason, '')), '');
  v_previous text;
  v_checkin_id uuid;
begin
  if v_admin is null then
    raise exception 'Sign in to correct attendance' using errcode = '42501';
  end if;

  if p_status not in ('present', 'late', 'excused', 'absent') then
    raise exception 'Unknown attendance status' using errcode = '22023';
  end if;

  if v_note is null or char_length(v_note) < 3 or char_length(v_note) > 500 then
    raise exception 'A reason between 3 and 500 characters is required' using errcode = '22023';
  end if;

  -- Physical verification is the whole point of the exception. It is checked
  -- here, not only in the UI, so a hand-crafted request cannot bypass it.
  if p_status = 'present' and not coalesce(p_physically_verified, false) then
    raise exception 'Confirm you physically verified the student at the attendance location' using errcode = '22023';
  end if;

  select
    * into v_session
  from
    public.discussion_sessions s
  where
    s.id = p_session_id for
  update;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_session.class_id) then
    raise exception 'Not allowed to correct attendance for this session' using errcode = '42501';
  end if;

  select
    m.joined_at into v_joined_at
  from
    public.class_members m
  where
    m.class_id = v_session.class_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'That user is not a member of this class' using errcode = '22023';
  end if;

  if v_joined_at > v_session.starts_at then
    raise exception 'That member joined after this meeting' using errcode = '22023';
  end if;

  select
    c.status
  into
    v_previous
  from
    public.discussion_session_checkins c
  where
    c.session_id = p_session_id
    and c.user_id = p_user_id;

  v_previous := coalesce(v_previous, 'not_recorded');

  insert into public.discussion_session_checkins (
    session_id,
    user_id,
    status,
    method,
    note,
    reviewed_by,
    reviewed_at
  ) values (
    p_session_id,
    p_user_id,
    p_status,
    'manual',
    v_note,
    v_admin,
    now()
  ) on conflict (session_id, user_id) do update
  set
    status = excluded.status,
    method = 'manual',
    note = excluded.note,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = now()
  returning
    id into v_checkin_id;

  insert into public.attendance_correction_audits (
    session_id,
    class_id,
    subject_id,
    student_id,
    admin_id,
    previous_status,
    new_status,
    reason,
    physically_verified,
    verification_method,
    metadata
  ) values (
    p_session_id,
    v_session.class_id,
    v_session.subject_id,
    p_user_id,
    v_admin,
    v_previous,
    p_status,
    v_note,
    coalesce(p_physically_verified, false),
    case
      when coalesce(p_physically_verified, false) then 'physical'
      else 'manual'
    end,
    jsonb_build_object(
      'meeting_number', v_session.meeting_number,
      'meeting_date', v_session.meeting_date,
      'subject_id', v_session.subject_id
    )
  );

  perform public.record_audit (
    'attendance_correction_recorded',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('status', p_status, 'previous_status', v_previous)
  );

  return v_checkin_id;
end;
$$;


COMMENT ON function public.record_attendance_correction (uuid, uuid, text, text, boolean) IS 'Manager-only manual correction. A present/late override requires an explicit physical-verification attestation; every correction writes an append-only audit row.';


-- ---------------------------------------------------------------------------
-- attendance_correction_audit_list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_correction_audit_list (p_class_id uuid, p_subject_id uuid DEFAULT NULL) returns TABLE (
  id uuid,
  session_id uuid,
  meeting_number integer,
  meeting_date date,
  student_id uuid,
  student_nim text,
  student_name text,
  subject_id uuid,
  subject_name text,
  previous_status text,
  new_status text,
  reason text,
  physically_verified boolean,
  verification_method text,
  admin_name text,
  created_at timestamptz
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if not public.can_manage_class (p_class_id) then
    raise exception 'Not allowed to view attendance corrections' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.session_id,
    s.meeting_number,
    s.meeting_date,
    a.student_id,
    p.nim,
    coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Student') as student_name,
    a.subject_id,
    subject.name as subject_name,
    a.previous_status,
    a.new_status,
    a.reason,
    a.physically_verified,
    a.verification_method,
    coalesce(nullif(btrim(admin_profile.full_name), ''), admin_profile.display_name, 'Admin') as admin_name,
    a.created_at
  from
    public.attendance_correction_audits a
    left join public.discussion_sessions s on s.id = a.session_id
    left join public.profiles p on p.id = a.student_id
    left join public.profiles admin_profile on admin_profile.id = a.admin_id
    left join public.class_subjects subject on subject.id = a.subject_id
  where
    a.class_id = p_class_id
    and (p_subject_id is null or a.subject_id = p_subject_id)
  order by
    a.created_at desc;
end;
$$;


COMMENT ON function public.attendance_correction_audit_list (uuid, uuid) IS 'Append-only correction audit for exports and review. Class managers only.';


REVOKE ALL ON function public.record_attendance_correction (uuid, uuid, text, text, boolean)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.attendance_correction_audit_list (uuid, uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.record_attendance_correction (uuid, uuid, text, text, boolean) TO authenticated;


GRANT
EXECUTE ON function public.attendance_correction_audit_list (uuid, uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- Radius cap: 25..500 m (was 25..1000 m)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_attendance_meeting_location (
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_reason text
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_session public.discussion_sessions %rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select
    * into v_session
  from
    public.discussion_sessions s
  where
    s.id = p_session_id for
  update;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_session.class_id) then
    raise exception 'Not allowed to change the location of this meeting' using errcode = '42501';
  end if;

  if v_session.meeting_number is null then
    raise exception 'This session is not an attendance meeting' using errcode = '22023';
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'This meeting is not scheduled' using errcode = '22023';
  end if;

  if v_session.attendance_finalized_at is not null then
    raise exception 'Reopen this meeting before changing its location' using errcode = '22023';
  end if;

  if v_reason is null
  or char_length(v_reason) < 3
  or char_length(v_reason) > 500 then
    raise exception 'A reason between 3 and 500 characters is required' using errcode = '22023';
  end if;

  if p_latitude is null
  or p_longitude is null
  or p_latitude not between -90 and 90
  or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if p_radius_m is null
  or p_radius_m not between 25 and 500 then
    raise exception 'Radius must be between 25 and 500 metres' using errcode = '22023';
  end if;

  update public.discussion_sessions
  set
    checkin_latitude = p_latitude,
    checkin_longitude = p_longitude,
    checkin_radius_m = p_radius_m,
    updated_at = now()
  where
    id = p_session_id;

  perform public.record_audit (
    'attendance_meeting_location_changed',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object(
      'old_radius_m', v_session.checkin_radius_m,
      'radius_m', p_radius_m,
      'reason', v_reason
    )
  );

  return true;
end;
$$;


CREATE OR REPLACE FUNCTION public.set_discussion_session_checkin_location (
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer DEFAULT 150
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_session public.discussion_sessions %rowtype;
begin
  select
    * into v_session
  from
    public.discussion_sessions s
  where
    s.id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_session.class_id) then
    raise exception 'Not allowed to change check-in for this session' using errcode = '42501';
  end if;

  if v_session.session_type <> 'in_person' then
    raise exception 'Only in-person sessions can have a check-in location' using errcode = '22023';
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'Check-in can only be configured on a scheduled session' using errcode = '22023';
  end if;

  if v_session.attendance_opened_at is not null
  and v_session.attendance_closed_at is null then
    raise exception 'The location is locked while attendance is open. Use the explicit location change action.' using errcode = 'SS112';
  end if;

  if v_session.attendance_finalized_at is not null then
    raise exception 'Reopen the meeting before changing its location' using errcode = '22023';
  end if;

  if p_latitude is null
  or p_longitude is null
  or p_latitude not between -90 and 90
  or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if p_radius_m is null
  or p_radius_m not between 25 and 500 then
    raise exception 'Radius must be between 25 and 500 metres' using errcode = '22023';
  end if;

  update public.discussion_sessions
  set
    checkin_latitude = p_latitude,
    checkin_longitude = p_longitude,
    checkin_radius_m = p_radius_m,
    updated_at = now()
  where
    id = p_session_id;

  perform public.record_audit (
    'session_checkin_location_set',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('radius_m', p_radius_m)
  );

  return true;
end;
$$;


CREATE OR REPLACE FUNCTION public.create_attendance_meeting (
  p_class_id uuid,
  p_subject_id uuid,
  p_meeting_number integer,
  p_meeting_date date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_location text,
  p_late_after_minutes integer DEFAULT 10,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_radius_m integer DEFAULT 100,
  p_title text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_subject public.class_subjects %rowtype;
  v_starts_at timestamptz := p_starts_at;
  v_ends_at timestamptz := p_ends_at;
  v_opens_at timestamptz := coalesce(p_opens_at, p_starts_at);
  v_closes_at timestamptz := coalesce(p_closes_at, p_ends_at);
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_title text;
  v_meeting_date date := coalesce(p_meeting_date, (p_starts_at at time zone 'Asia/Jakarta')::date);
  v_id uuid;
begin
  if not public.can_organize_class_sessions (p_class_id) then
    raise exception 'Not allowed to create attendance meetings for this class' using errcode = '42501';
  end if;

  if p_meeting_number is null
  or p_meeting_number < 1
  or p_meeting_number > 999 then
    raise exception 'Meeting number must be between 1 and 999' using errcode = '22023';
  end if;

  select
    * into v_subject
  from
    public.class_subjects s
  where
    s.id = p_subject_id
    and s.class_id = p_class_id;

  if not found then
    raise exception 'The subject does not belong to this class' using errcode = '22023';
  end if;

  if v_subject.status <> 'active' then
    raise exception 'The subject is archived' using errcode = '22023';
  end if;

  if v_starts_at is null
  or v_ends_at is null
  or v_ends_at <= v_starts_at
  or v_ends_at > v_starts_at + interval '24 hours' then
    raise exception 'The meeting window is not valid' using errcode = '22023';
  end if;

  if v_closes_at <= v_opens_at then
    raise exception 'Attendance must close after it opens' using errcode = '22023';
  end if;

  if v_location is null
  or char_length(v_location) < 3
  or char_length(v_location) > 200 then
    raise exception 'The location must be between 3 and 200 characters' using errcode = '22023';
  end if;

  if p_late_after_minutes is null
  or p_late_after_minutes < 0
  or p_late_after_minutes > 240 then
    raise exception 'The late deadline must be between 0 and 240 minutes' using errcode = '22023';
  end if;

  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Both coordinates are required' using errcode = '22023';
  end if;

  if p_latitude is not null
  and (
    p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
  ) then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if p_radius_m is null
  or p_radius_m not between 25 and 500 then
    raise exception 'Radius must be between 25 and 500 metres' using errcode = '22023';
  end if;

  v_title := coalesce(
    nullif(btrim(coalesce(p_title, '')), ''),
    left(v_subject.name || ' · Pertemuan ' || p_meeting_number::text, 160)
  );

  insert into public.discussion_sessions (
    class_id,
    organizer_id,
    subject_id,
    meeting_number,
    meeting_date,
    title,
    description,
    session_type,
    location,
    starts_at,
    ends_at,
    time_zone,
    visibility,
    status,
    attendance_opens_at,
    attendance_closes_at,
    late_after_minutes,
    checkin_latitude,
    checkin_longitude,
    checkin_radius_m
  ) values (
    p_class_id,
    auth.uid (),
    p_subject_id,
    p_meeting_number,
    v_meeting_date,
    v_title,
    format('Attendance meeting %s for %s.', p_meeting_number, v_subject.name),
    'in_person',
    v_location,
    v_starts_at,
    v_ends_at,
    'Asia/Jakarta',
    'class_members',
    'scheduled',
    v_opens_at,
    v_closes_at,
    p_late_after_minutes,
    p_latitude,
    p_longitude,
    p_radius_m
  )
  returning
    id into v_id;

  perform public.record_audit (
    'attendance_meeting_created',
    'discussion_session',
    v_id,
    p_class_id,
    jsonb_build_object(
      'subject_id', p_subject_id,
      'meeting_number', p_meeting_number,
      'radius_m', p_radius_m,
      'late_after_minutes', p_late_after_minutes
    )
  );

  return v_id;
end;
$$;
