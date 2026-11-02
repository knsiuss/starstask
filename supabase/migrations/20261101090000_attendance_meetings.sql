-- Session-based attendance meetings.
--
-- An attendance meeting is a `discussion_sessions` row with a subject and a
-- meeting number. Reusing the session table keeps RSVP, reminders, calendar
-- sync, and the existing check-in rows working; the extra columns add the
-- meeting identity, the manual open/close state, and the late deadline.
--
-- A session without `meeting_number` keeps the original derived check-in window
-- (`starts_at - 15m` .. `ends_at`) and the original check-in function. Only a
-- meeting uses the identity-verified flow in this migration, so a student
-- cannot bypass the name/NIM check by calling the older RPC.
--
-- Nothing here is applied automatically; the migration is applied by the owner.
-- ---------------------------------------------------------------------------
-- Meeting identity and attendance state
-- ---------------------------------------------------------------------------
ALTER TABLE public.discussion_sessions
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.class_subjects (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_number integer,
  ADD COLUMN IF NOT EXISTS meeting_date date,
  ADD COLUMN IF NOT EXISTS attendance_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_after_minutes integer NOT NULL DEFAULT 10;


ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_meeting_number_range;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_meeting_number_range CHECK (
    meeting_number IS NULL
    OR meeting_number BETWEEN 1 AND 999
  );


-- A meeting must name both its subject and its number, or neither. Sessions
-- created before this migration stay valid and keep their old behaviour.
ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_meeting_identity;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_meeting_identity CHECK (
    (
      meeting_number IS NULL
      AND subject_id IS NULL
    )
    OR (
      meeting_number IS NOT NULL
      AND subject_id IS NOT NULL
    )
  );


ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_attendance_window;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_attendance_window CHECK (
    attendance_opens_at IS NULL
    OR attendance_closes_at IS NULL
    OR attendance_closes_at > attendance_opens_at
  );


ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_late_after_range;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_late_after_range CHECK (late_after_minutes BETWEEN 0 AND 240);


-- Closed implies opened, and finalized implies closed. A state that skips a
-- step would make the check-in function's branch order ambiguous.
ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_attendance_state;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_attendance_state CHECK (
    (
      attendance_closed_at IS NULL
      OR attendance_opened_at IS NOT NULL
    )
    AND (
      attendance_finalized_at IS NULL
      OR attendance_closed_at IS NOT NULL
    )
  );


CREATE UNIQUE INDEX IF NOT EXISTS discussion_sessions_class_subject_meeting_uniq ON public.discussion_sessions (class_id, subject_id, meeting_number)
WHERE
  meeting_number IS NOT NULL
  AND subject_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS discussion_sessions_attendance_open_idx ON public.discussion_sessions (class_id, attendance_opened_at DESC)
WHERE
  meeting_number IS NOT NULL;


COMMENT ON COLUMN public.discussion_sessions.subject_id IS 'Subject a meeting belongs to. NULL for an ordinary discussion session.';

COMMENT ON COLUMN public.discussion_sessions.meeting_number IS 'Pertemuan number. Unique per class and subject.';

COMMENT ON COLUMN public.discussion_sessions.meeting_date IS 'Calendar date of the meeting, used by reports and exports.';

COMMENT ON COLUMN public.discussion_sessions.attendance_opened_at IS 'Set by a class admin when attendance opens. NULL means closed.';

COMMENT ON COLUMN public.discussion_sessions.attendance_closed_at IS 'Set when attendance closes or is finalized.';

COMMENT ON COLUMN public.discussion_sessions.attendance_finalized_at IS 'Set when missing eligible members are written as absent. Immutable until reopened.';

COMMENT ON COLUMN public.discussion_sessions.late_after_minutes IS 'Minutes after the meeting start that still count as present.';


-- ---------------------------------------------------------------------------
-- Subject belongs to the same class, and meeting defaults
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discussion_sessions_fill_attendance_meeting () returns trigger language plpgsql
SET
  search_path = public,
  pg_temp AS $$
declare
  v_subject_class uuid;
begin
  if new.meeting_number is null then
    return new;
  end if;

  if new.session_type <> 'in_person' then
    raise exception 'An attendance meeting must be in person' using errcode = '23514';
  end if;

  select
    s.class_id into v_subject_class
  from
    public.class_subjects s
  where
    s.id = new.subject_id;

  if v_subject_class is null or v_subject_class <> new.class_id then
    raise exception 'The subject does not belong to this class' using errcode = '23514';
  end if;

  new.meeting_date := coalesce(new.meeting_date, (new.starts_at at time zone coalesce(new.time_zone, 'Asia/Jakarta'))::date);
  new.attendance_opens_at := coalesce(new.attendance_opens_at, new.starts_at);
  new.attendance_closes_at := coalesce(new.attendance_closes_at, new.ends_at);

  return new;
end;
$$;


DROP TRIGGER IF EXISTS discussion_sessions_fill_attendance_meeting ON public.discussion_sessions;


CREATE TRIGGER discussion_sessions_fill_attendance_meeting BEFORE INSERT
OR UPDATE OF meeting_number,
subject_id,
starts_at,
ends_at,
time_zone ON public.discussion_sessions FOR EACH ROW
EXECUTE FUNCTION public.discussion_sessions_fill_attendance_meeting ();


-- ---------------------------------------------------------------------------
-- Verification attempts
-- ---------------------------------------------------------------------------
-- Only the outcome and the derived distance/accuracy are kept. The name and NIM
-- the student typed are never stored: they are answers to a check, not records.
CREATE TABLE IF NOT EXISTS public.attendance_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  session_id uuid NOT NULL REFERENCES public.discussion_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  outcome text NOT NULL,
  distance_m double precision,
  accuracy_m double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_verification_attempts_outcome CHECK (
    outcome IN (
      'checked_in',
      'already_checked_in',
      'name_mismatch',
      'nim_mismatch',
      'identity_missing',
      'outside_radius',
      'imprecise',
      'closed',
      'not_open',
      'not_available'
    )
  ),
  CONSTRAINT attendance_verification_attempts_distance CHECK (distance_m IS NULL OR distance_m >= 0),
  CONSTRAINT attendance_verification_attempts_accuracy CHECK (accuracy_m IS NULL OR accuracy_m >= 0)
);


COMMENT ON TABLE public.attendance_verification_attempts IS 'Failed and successful identity/GPS attempts for attendance meetings. Read only through attendance_meeting_failures(). No typed name or NIM is stored.';


CREATE INDEX IF NOT EXISTS attendance_verification_attempts_session_idx ON public.attendance_verification_attempts (session_id, created_at DESC);


ALTER TABLE public.attendance_verification_attempts enable ROW LEVEL SECURITY;


REVOKE ALL ON public.attendance_verification_attempts
FROM
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- Check-in row: identity proof and system-generated absences
-- ---------------------------------------------------------------------------
ALTER TABLE public.discussion_session_checkins
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;


ALTER TABLE public.discussion_session_checkins DROP CONSTRAINT IF EXISTS discussion_session_checkins_method_allowed;


ALTER TABLE public.discussion_session_checkins
  ADD CONSTRAINT discussion_session_checkins_method_allowed CHECK (method IN ('geo', 'manual', 'system'));


ALTER TABLE public.discussion_session_checkins DROP CONSTRAINT IF EXISTS discussion_session_checkins_geo_fields;


ALTER TABLE public.discussion_session_checkins
  ADD CONSTRAINT discussion_session_checkins_geo_fields CHECK (
    method IN ('manual', 'system')
    OR (
      (
        latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND accuracy_m IS NOT NULL
        AND distance_m IS NOT NULL
      )
      OR (
        coordinates_purged_at IS NOT NULL
        AND latitude IS NULL
        AND longitude IS NULL
      )
    )
  );


COMMENT ON COLUMN public.discussion_session_checkins.identity_verified IS 'True when the caller typed a name and NIM matching the profile.';

COMMENT ON COLUMN public.discussion_session_checkins.method IS 'geo = location check-in, manual = admin record, system = auto-generated absence on finalize.';


-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_normalize_identity (p_value text) returns text language sql immutable
SET
  search_path = pg_catalog,
  pg_temp AS $$
select
  regexp_replace(btrim(lower(coalesce(p_value, ''))), '\s+', ' ', 'g');
$$;


CREATE OR REPLACE FUNCTION public.log_attendance_verification (
  p_session_id uuid,
  p_user_id uuid,
  p_outcome text,
  p_distance_m double precision DEFAULT NULL,
  p_accuracy_m double precision DEFAULT NULL
) returns void language sql security definer
SET
  search_path = public,
  pg_temp AS $$
insert into public.attendance_verification_attempts (
  session_id,
  user_id,
  outcome,
  distance_m,
  accuracy_m
) values (
  p_session_id,
  p_user_id,
  p_outcome,
  p_distance_m,
  p_accuracy_m
);
$$;


REVOKE ALL ON function public.attendance_normalize_identity (text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.log_attendance_verification (uuid, uuid, text, double precision, double precision)
FROM
  public,
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- create_attendance_meeting
-- ---------------------------------------------------------------------------
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
  p_radius_m integer DEFAULT 150,
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
  or p_radius_m not between 25 and 1000 then
    raise exception 'Radius must be between 25 and 1000 metres' using errcode = '22023';
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


COMMENT ON function public.create_attendance_meeting (
  uuid,
  uuid,
  integer,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  integer,
  double precision,
  double precision,
  integer,
  text
) IS 'Creates one in-person attendance meeting. Class organizers only; a duplicate meeting number is rejected by a unique index.';


-- ---------------------------------------------------------------------------
-- open_attendance_meeting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_attendance_meeting (p_session_id uuid) returns boolean language plpgsql security definer
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
    s.id = p_session_id for
  update;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_session.class_id) then
    raise exception 'Not allowed to open attendance for this meeting' using errcode = '42501';
  end if;

  if v_session.meeting_number is null then
    raise exception 'This session is not an attendance meeting' using errcode = '22023';
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'This meeting is not scheduled' using errcode = '22023';
  end if;

  if v_session.checkin_latitude is null
  or v_session.checkin_longitude is null then
    raise exception 'Set the meeting location before opening attendance' using errcode = 'SS101';
  end if;

  if v_session.attendance_finalized_at is not null then
    raise exception 'Reopen this meeting before opening it again' using errcode = 'SS111';
  end if;

  if v_session.attendance_opened_at is not null
  and v_session.attendance_closed_at is null then
    return true;
  end if;

  if now() > coalesce(v_session.attendance_closes_at, v_session.ends_at) then
    raise exception 'The attendance window has already closed' using errcode = 'SS103';
  end if;

  update public.discussion_sessions
  set
    attendance_opened_at = now(),
    attendance_closed_at = null,
    attendance_finalized_at = null,
    updated_at = now()
  where
    id = p_session_id;

  perform public.record_audit (
    'attendance_meeting_opened',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('meeting_number', v_session.meeting_number)
  );

  return true;
end;
$$;


COMMENT ON function public.open_attendance_meeting (uuid) IS 'Opens check-in for one meeting. Class organizers only; the location must already be set.';


-- ---------------------------------------------------------------------------
-- close_attendance_meeting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_attendance_meeting (
  p_session_id uuid,
  p_finalize boolean DEFAULT true
) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_session public.discussion_sessions %rowtype;
  v_inserted integer := 0;
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
    raise exception 'Not allowed to close attendance for this meeting' using errcode = '42501';
  end if;

  if v_session.meeting_number is null then
    raise exception 'This session is not an attendance meeting' using errcode = '22023';
  end if;

  if v_session.attendance_opened_at is null then
    raise exception 'Attendance has not been opened' using errcode = '22023';
  end if;

  if v_session.attendance_finalized_at is not null then
    return 0;
  end if;

  if p_finalize then
    -- Every eligible member without a row becomes an explicit absence. This is
    -- the only place an absence is created from silence, and only on finalize.
    insert into public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      note,
      reviewed_by,
      reviewed_at
    )
    select
      p_session_id,
      m.user_id,
      'absent',
      'system',
      'Finalized without a check-in',
      auth.uid (),
      now()
    from
      public.class_members m
    where
      m.class_id = v_session.class_id
      and m.joined_at <= v_session.starts_at
      and not exists (
        select
          1
        from
          public.discussion_session_checkins c
        where
          c.session_id = p_session_id
          and c.user_id = m.user_id
      )
    on conflict (session_id, user_id) do nothing;

    get diagnostics v_inserted = row_count;
  end if;

  update public.discussion_sessions
  set
    attendance_closed_at = coalesce(attendance_closed_at, now()),
    attendance_finalized_at = case
      when p_finalize then coalesce(attendance_finalized_at, now())
      else attendance_finalized_at
    end,
    updated_at = now()
  where
    id = p_session_id;

  perform public.record_audit (
    case
      when p_finalize then 'attendance_meeting_finalized'
      else 'attendance_meeting_closed'
    end,
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('absent_created', v_inserted)
  );

  return v_inserted;
end;
$$;


COMMENT ON function public.close_attendance_meeting (uuid, boolean) IS 'Closes attendance and, when finalizing, writes an absent row for every eligible member without a record. Returns the number created.';


-- ---------------------------------------------------------------------------
-- reopen_attendance_meeting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_attendance_meeting (p_session_id uuid) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_session public.discussion_sessions %rowtype;
  v_deleted integer := 0;
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
    raise exception 'Not allowed to reopen attendance for this meeting' using errcode = '42501';
  end if;

  if v_session.meeting_number is null then
    raise exception 'This session is not an attendance meeting' using errcode = '22023';
  end if;

  if v_session.attendance_opened_at is null then
    raise exception 'Attendance has not been opened' using errcode = '22023';
  end if;

  if v_session.attendance_closed_at is null then
    return 0;
  end if;

  delete from public.discussion_session_checkins c
  where
    c.session_id = p_session_id
    and c.method = 'system'
    and c.status = 'absent';

  get diagnostics v_deleted = row_count;

  update public.discussion_sessions
  set
    attendance_closed_at = null,
    attendance_finalized_at = null,
    updated_at = now()
  where
    id = p_session_id;

  perform public.record_audit (
    'attendance_meeting_reopened',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('system_absences_removed', v_deleted)
  );

  return v_deleted;
end;
$$;


COMMENT ON function public.reopen_attendance_meeting (uuid) IS 'Reopens a closed or finalized meeting and removes only system-generated absences. Manual records stay.';


-- ---------------------------------------------------------------------------
-- update_attendance_meeting_location
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
  or p_radius_m not between 25 and 1000 then
    raise exception 'Radius must be between 25 and 1000 metres' using errcode = '22023';
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


COMMENT ON function public.update_attendance_meeting_location (uuid, double precision, double precision, integer, text) IS 'Explicit, audited location change. Required because a location is otherwise locked while attendance is open.';


-- ---------------------------------------------------------------------------
-- check_in_attendance_meeting
-- ---------------------------------------------------------------------------
-- Returns a JSON result instead of raising for a validation failure, so the API
-- can return the exact distance, radius, and next step without parsing a
-- Postgres message.
CREATE OR REPLACE FUNCTION public.check_in_attendance_meeting (
  p_session_id uuid,
  p_full_name text,
  p_nim text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_session public.discussion_sessions %rowtype;
  v_profile public.profiles %rowtype;
  v_checkin public.discussion_session_checkins %rowtype;
  v_distance double precision;
  v_new_status text;
  v_checkin_id uuid;
  v_joined_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Sign in to check in' using errcode = '42501';
  end if;

  if p_latitude is null
  or p_longitude is null
  or p_latitude not between -90 and 90
  or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
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

  if not public.is_class_member (v_session.class_id) then
    raise exception 'Only class members can check in' using errcode = '42501';
  end if;

  select
    m.joined_at into v_joined_at
  from
    public.class_members m
  where
    m.class_id = v_session.class_id
    and m.user_id = v_user_id;

  if v_joined_at is null
  or v_joined_at > v_session.starts_at then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'You joined this class after the meeting started, so this meeting is not part of your attendance.'
    );
  end if;

  if v_session.meeting_number is null then
    raise exception 'This session is not an attendance meeting' using errcode = '22023';
  end if;

  if v_session.status <> 'scheduled' then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'This meeting is not open for check-in.'
    );
  end if;

  if v_session.attendance_opened_at is null then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'not_open');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_not_open',
      'message', 'Attendance has not been opened for this meeting.'
    );
  end if;

  if v_session.attendance_closed_at is not null
  or v_session.attendance_finalized_at is not null then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'Attendance for this meeting has closed.'
    );
  end if;

  if now() > coalesce(v_session.attendance_closes_at, v_session.ends_at) then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'The attendance window has ended.'
    );
  end if;

  if v_session.checkin_latitude is null
  or v_session.checkin_longitude is null then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'This meeting has no attendance location configured.'
    );
  end if;

  if p_accuracy_m is null
  or p_accuracy_m < 0
  or p_accuracy_m > 100 then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'imprecise', NULL, p_accuracy_m);
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_imprecise',
      'message', 'Your location reading is not accurate enough. Move somewhere with a clearer signal and try again.',
      'accuracyM', p_accuracy_m,
      'maxAccuracyM', 100
    );
  end if;

  select
    * into v_profile
  from
    public.profiles p
  where
    p.id = v_user_id;

  if not found
  or public.attendance_normalize_identity (v_profile.full_name) = ''
  or public.attendance_normalize_identity (v_profile.nim) = '' then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'identity_missing');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_identity_missing',
      'message', 'Add your full name and NIM in your profile before checking in.'
    );
  end if;

  if public.attendance_normalize_identity (p_full_name) <> public.attendance_normalize_identity (v_profile.full_name) then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'name_mismatch');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_name_mismatch',
      'message', 'The name you entered does not match your verified profile. Correct it in your profile, then try again.'
    );
  end if;

  if public.attendance_normalize_identity (p_nim) <> public.attendance_normalize_identity (v_profile.nim) then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'nim_mismatch');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_nim_mismatch',
      'message', 'The NIM you entered does not match your verified profile. Correct it in your profile, then try again.'
    );
  end if;

  v_distance := public.distance_meters (
    p_latitude,
    p_longitude,
    v_session.checkin_latitude,
    v_session.checkin_longitude
  );

  if v_distance > v_session.checkin_radius_m then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'outside_radius', v_distance, p_accuracy_m);
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_too_far',
      'message', format(
        'You are %s m from the meeting point. The allowed radius is %s m.',
        round(v_distance)::integer,
        v_session.checkin_radius_m
      ),
      'distanceM', round(v_distance)::integer,
      'radiusM', v_session.checkin_radius_m
    );
  end if;

  select
    * into v_checkin
  from
    public.discussion_session_checkins c
  where
    c.session_id = p_session_id
    and c.user_id = v_user_id;

  if found
  and not (
    v_checkin.method in ('manual', 'system')
    and v_checkin.reviewed_at is null
  ) then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'already_checked_in', v_checkin.distance_m, v_checkin.accuracy_m);
    return jsonb_build_object(
      'ok', true,
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  end if;

  v_new_status := case
    when now() > v_session.starts_at + make_interval (mins => v_session.late_after_minutes) then 'late'
    else 'present'
  end;

  if v_checkin.id is not null then
    update public.discussion_session_checkins
    set
      status = v_new_status,
      method = 'geo',
      latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = p_accuracy_m,
      distance_m = v_distance,
      checked_in_at = now(),
      note = null,
      identity_verified = true,
      identity_verified_at = now(),
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
    where
      id = v_checkin.id
    returning
      id into v_checkin_id;
  else
    insert into public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      latitude,
      longitude,
      accuracy_m,
      distance_m,
      identity_verified,
      identity_verified_at
    ) values (
      p_session_id,
      v_user_id,
      v_new_status,
      'geo',
      p_latitude,
      p_longitude,
      p_accuracy_m,
      v_distance,
      true,
      now()
    )
    on conflict (session_id, user_id) do nothing
    returning
      id into v_checkin_id;
  end if;

  if v_checkin_id is null then
    select
      * into v_checkin
    from
      public.discussion_session_checkins c
    where
      c.session_id = p_session_id
      and c.user_id = v_user_id;

    perform public.log_attendance_verification (p_session_id, v_user_id, 'already_checked_in', v_checkin.distance_m, v_checkin.accuracy_m);

    return jsonb_build_object(
      'ok', true,
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  end if;

  perform public.log_attendance_verification (p_session_id, v_user_id, 'checked_in', v_distance, p_accuracy_m);

  perform public.record_audit (
    'attendance_meeting_checked_in',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('status', v_new_status, 'distance_m', round(v_distance))
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_checkin_id,
    'status', v_new_status,
    'checked_in_at', now(),
    'distance_m', v_distance,
    'accuracy_m', p_accuracy_m,
    'already_checked_in', false
  );
end;
$$;


COMMENT ON function public.check_in_attendance_meeting (uuid, text, text, double precision, double precision, double precision) IS 'Identity-verified GPS check-in for one meeting. The profile name and NIM must match; distance, window, and membership are decided here.';


-- ---------------------------------------------------------------------------
-- attendance_meeting_roster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_meeting_roster (p_session_id uuid) returns TABLE (
  user_id uuid,
  full_name text,
  nim text,
  display_name text,
  joined_at timestamptz,
  eligible boolean,
  status text,
  method text,
  checked_in_at timestamptz,
  distance_m double precision,
  accuracy_m double precision,
  note text,
  reviewed_at timestamptz,
  identity_verified boolean
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
  v_starts_at timestamptz;
  v_finalized boolean;
begin
  select
    s.class_id,
    s.starts_at,
    s.attendance_finalized_at is not null
  into
    v_class_id,
    v_starts_at,
    v_finalized
  from
    public.discussion_sessions s
  where
    s.id = p_session_id;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'Not allowed to view this attendance roster' using errcode = '42501';
  end if;

  return query
  select
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member') as full_name,
    p.nim,
    p.display_name,
    m.joined_at,
    m.joined_at <= v_starts_at as eligible,
    case
      when m.joined_at > v_starts_at then 'not_applicable'
      when c.id is not null then c.status
      when v_finalized then 'absent'
      else 'not_recorded'
    end as status,
    c.method,
    c.checked_in_at,
    c.distance_m,
    c.accuracy_m,
    c.note,
    c.reviewed_at,
    coalesce(c.identity_verified, false) as identity_verified
  from
    public.class_members m
    left join public.profiles p on p.id = m.user_id
    left join public.discussion_session_checkins c on c.session_id = p_session_id
    and c.user_id = m.user_id
  where
    m.class_id = v_class_id
  order by
    lower(coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member')) asc,
    p.nim asc nulls last,
    m.user_id asc;
end;
$$;


COMMENT ON function public.attendance_meeting_roster (uuid) IS 'Master roster for one meeting, alphabetically by full name then NIM. Class organizers only. Includes members who joined after the meeting with eligible = false.';


-- ---------------------------------------------------------------------------
-- attendance_meeting_failures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_meeting_failures (p_session_id uuid) returns TABLE (
  user_id uuid,
  display_name text,
  outcome text,
  distance_m double precision,
  accuracy_m double precision,
  created_at timestamptz
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
begin
  select
    s.class_id into v_class_id
  from
    public.discussion_sessions s
  where
    s.id = p_session_id;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'Not allowed to view verification failures' using errcode = '42501';
  end if;

  return query
  select
    a.user_id,
    coalesce(p.display_name, 'Member') as display_name,
    a.outcome,
    a.distance_m,
    a.accuracy_m,
    a.created_at
  from
    public.attendance_verification_attempts a
    left join public.profiles p on p.id = a.user_id
  where
    a.session_id = p_session_id
    and a.outcome not in ('checked_in', 'already_checked_in')
  order by
    a.created_at desc
  limit 100;
end;
$$;


COMMENT ON function public.attendance_meeting_failures (uuid) IS 'Recent failed identity/GPS attempts for one meeting. Managers only; entered name and NIM are never stored or returned.';


-- ---------------------------------------------------------------------------
-- class_attendance_roster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_attendance_roster (p_class_id uuid) returns TABLE (
  user_id uuid,
  full_name text,
  nim text,
  display_name text,
  joined_at timestamptz
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if not public.can_manage_class (p_class_id) then
    raise exception 'Not allowed to view the class roster' using errcode = '42501';
  end if;

  return query
  select
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member') as full_name,
    p.nim,
    p.display_name,
    m.joined_at
  from
    public.class_members m
    left join public.profiles p on p.id = m.user_id
  where
    m.class_id = p_class_id
  order by
    lower(coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member')) asc,
    p.nim asc nulls last,
    m.user_id asc;
end;
$$;


COMMENT ON function public.class_attendance_roster (uuid) IS 'Master class roster with private full name and NIM, alphabetically sorted. Class managers only.';


-- ---------------------------------------------------------------------------
-- class_attendance_recap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_attendance_recap (
  p_class_id uuid,
  p_subject_id uuid
) returns TABLE (
  session_id uuid,
  meeting_number integer,
  meeting_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  title text,
  location text,
  attendance_opens_at timestamptz,
  attendance_closes_at timestamptz,
  attendance_opened_at timestamptz,
  attendance_closed_at timestamptz,
  attendance_finalized_at timestamptz,
  user_id uuid,
  full_name text,
  nim text,
  joined_at timestamptz,
  eligible boolean,
  status text
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if not public.can_manage_class (p_class_id) then
    raise exception 'Not allowed to view the attendance recap' using errcode = '42501';
  end if;

  if not exists (
    select
      1
    from
      public.class_subjects s
    where
      s.id = p_subject_id
      and s.class_id = p_class_id
  ) then
    raise exception 'The subject does not belong to this class' using errcode = '22023';
  end if;

  return query
  select
    s.id,
    s.meeting_number,
    s.meeting_date,
    s.starts_at,
    s.ends_at,
    s.title,
    s.location,
    s.attendance_opens_at,
    s.attendance_closes_at,
    s.attendance_opened_at,
    s.attendance_closed_at,
    s.attendance_finalized_at,
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member') as full_name,
    p.nim,
    m.joined_at,
    m.joined_at <= s.starts_at as eligible,
    case
      when m.joined_at > s.starts_at then 'not_applicable'
      when c.id is not null then c.status
      when s.attendance_finalized_at is not null then 'absent'
      else 'not_recorded'
    end as status
  from
    public.discussion_sessions s
    join public.class_members m on m.class_id = s.class_id
    left join public.profiles p on p.id = m.user_id
    left join public.discussion_session_checkins c on c.session_id = s.id
    and c.user_id = m.user_id
  where
    s.class_id = p_class_id
    and s.subject_id = p_subject_id
    and s.meeting_number is not null
    and s.status <> 'cancelled'
  order by
    s.meeting_number asc,
    lower(coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member')) asc,
    p.nim asc nulls last;
end;
$$;


COMMENT ON function public.class_attendance_recap (uuid, uuid) IS 'Flat per-meeting status rows for a subject recap. Class managers only; late joiners are marked not_applicable, never absent.';


-- ---------------------------------------------------------------------------
-- class_attendance_meeting_list
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


-- ---------------------------------------------------------------------------
-- log_attendance_export
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_attendance_export (
  p_class_id uuid,
  p_subject_id uuid,
  p_session_id uuid,
  p_kind text
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if not public.can_manage_class (p_class_id) then
    raise exception 'Not allowed to export this attendance' using errcode = '42501';
  end if;

  if p_kind is null
  or p_kind not in ('meeting', 'recap', 'template') then
    raise exception 'Unknown export kind' using errcode = '22023';
  end if;

  perform public.record_audit (
    'attendance_exported',
    'class',
    p_class_id,
    p_class_id,
    jsonb_build_object(
      'kind', p_kind,
      'subject_id', p_subject_id,
      'session_id', p_session_id
    )
  );
end;
$$;


COMMENT ON function public.log_attendance_export (uuid, uuid, uuid, text) IS 'Records a manager-requested attendance export. Class managers only.';


-- ---------------------------------------------------------------------------
-- Existing session functions: lock the location, reject meeting bypass
-- ---------------------------------------------------------------------------
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
  or p_radius_m not between 25 and 1000 then
    raise exception 'Radius must be between 25 and 1000 metres' using errcode = '22023';
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


CREATE OR REPLACE FUNCTION public.clear_discussion_session_checkin_location (p_session_id uuid) returns boolean language plpgsql security definer
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

  if v_session.attendance_opened_at is not null
  and v_session.attendance_closed_at is null then
    raise exception 'The location is locked while attendance is open.' using errcode = 'SS112';
  end if;

  update public.discussion_sessions
  set
    checkin_latitude = null,
    checkin_longitude = null,
    updated_at = now()
  where
    id = p_session_id;

  perform public.record_audit (
    'session_checkin_location_cleared',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    '{}'::jsonb
  );

  return true;
end;
$$;


-- The original RPC must not become a way around identity verification. A
-- meeting uses check_in_attendance_meeting() only.
CREATE OR REPLACE FUNCTION public.check_in_discussion_session (
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_class_id uuid;
  v_meeting_number integer;
  v_session_type text;
  v_session_status text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_point_lat double precision;
  v_point_lon double precision;
  v_radius_m integer;
  v_distance double precision;
  v_checkin public.discussion_session_checkins %rowtype;
  v_checkin_id uuid;
  v_new_status text;
begin
  if v_user_id is null then
    raise exception 'Sign in to check in' using errcode = '42501';
  end if;

  if p_latitude is null
  or p_longitude is null
  or p_latitude not between -90 and 90
  or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if p_accuracy_m is null or p_accuracy_m < 0 then
    raise exception 'Turn on precise location and try again' using errcode = 'SS104';
  end if;

  if p_accuracy_m > 100 then
    raise exception 'Location accuracy is too weak. Move somewhere with a clearer signal and try again' using errcode = 'SS104';
  end if;

  select
    s.class_id,
    s.meeting_number,
    s.session_type,
    s.status,
    s.starts_at,
    s.ends_at,
    s.checkin_latitude,
    s.checkin_longitude,
    s.checkin_radius_m into v_class_id,
    v_meeting_number,
    v_session_type,
    v_session_status,
    v_starts_at,
    v_ends_at,
    v_point_lat,
    v_point_lon,
    v_radius_m
  from
    public.discussion_sessions s
  where
    s.id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if v_meeting_number is not null then
    raise exception 'Use the attendance meeting check-in for this session' using errcode = 'SS108';
  end if;

  if not (
    public.is_class_member (v_class_id)
    or public.can_organize_class_sessions (v_class_id)
  ) then
    raise exception 'Only class members can check in' using errcode = '42501';
  end if;

  if v_session_type <> 'in_person'
  or v_point_lat is null
  or v_point_lon is null then
    raise exception 'Check-in is not available for this session' using errcode = 'SS101';
  end if;

  if v_session_status <> 'scheduled' then
    raise exception 'This session is not open for check-in' using errcode = 'SS107';
  end if;

  if now() < v_starts_at - interval '15 minutes' then
    raise exception 'Check-in has not opened yet' using errcode = 'SS102';
  end if;

  if now() > v_ends_at then
    raise exception 'Check-in is closed' using errcode = 'SS103';
  end if;

  select
    * into v_checkin
  from
    public.discussion_session_checkins c
  where
    c.session_id = p_session_id
    and c.user_id = v_user_id;

  if found
  and not (v_checkin.method = 'manual' and v_checkin.reviewed_at is null) then
    return jsonb_build_object(
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  end if;

  v_distance := public.distance_meters (p_latitude, p_longitude, v_point_lat, v_point_lon);

  if v_distance > v_radius_m then
    raise exception 'You are outside the check-in radius' using errcode = 'SS105';
  end if;

  v_new_status := case
    when now() > v_starts_at + interval '10 minutes' then 'late'
    else 'present'
  end;

  if v_checkin.id is not null then
    update public.discussion_session_checkins
    set
      status = v_new_status,
      method = 'geo',
      latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = p_accuracy_m,
      distance_m = v_distance,
      checked_in_at = now(),
      note = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
    where
      id = v_checkin.id
    returning
      id into v_checkin_id;
  else
    insert into public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      latitude,
      longitude,
      accuracy_m,
      distance_m
    ) values (
      p_session_id,
      v_user_id,
      v_new_status,
      'geo',
      p_latitude,
      p_longitude,
      p_accuracy_m,
      v_distance
    )
    on conflict (session_id, user_id) do nothing
    returning
      id into v_checkin_id;
  end if;

  if v_checkin_id is null then
    select
      * into v_checkin
    from
      public.discussion_session_checkins c
    where
      c.session_id = p_session_id
      and c.user_id = v_user_id;

    return jsonb_build_object(
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  end if;

  perform public.record_audit (
    'session_checkin_recorded',
    'discussion_session',
    p_session_id,
    v_class_id,
    jsonb_build_object('distance_m', round(v_distance), 'status', v_new_status)
  );

  return jsonb_build_object(
    'id', v_checkin_id,
    'status', v_new_status,
    'checked_in_at', now(),
    'distance_m', v_distance,
    'accuracy_m', p_accuracy_m,
    'already_checked_in', false
  );
end;
$$;


-- A manual record cannot invent attendance for somebody who joined after the
-- meeting. Late joiners stay outside that meeting's denominator.
CREATE OR REPLACE FUNCTION public.record_discussion_session_checkin (
  p_session_id uuid,
  p_user_id uuid,
  p_status text,
  p_note text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
  v_starts_at timestamptz;
  v_meeting_number integer;
  v_joined_at timestamptz;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_checkin_id uuid;
begin
  if p_status not in ('present', 'late', 'excused', 'absent') then
    raise exception 'Unknown attendance status' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023';
  end if;

  select
    s.class_id,
    s.starts_at,
    s.meeting_number into v_class_id,
    v_starts_at,
    v_meeting_number
  from
    public.discussion_sessions s
  where
    s.id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'Not allowed to record attendance for this session' using errcode = '42501';
  end if;

  select
    m.joined_at into v_joined_at
  from
    public.class_members m
  where
    m.class_id = v_class_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'That user is not a member of this class' using errcode = '22023';
  end if;

  if v_meeting_number is not null
  and v_joined_at > v_starts_at then
    raise exception 'That member joined after this meeting' using errcode = '22023';
  end if;

  select
    c.id into v_checkin_id
  from
    public.discussion_session_checkins c
  where
    c.session_id = p_session_id
    and c.user_id = p_user_id;

  if v_checkin_id is not null then
    update public.discussion_session_checkins
    set
      status = p_status,
      note = v_note,
      reviewed_by = auth.uid (),
      reviewed_at = now(),
      updated_at = now()
    where
      id = v_checkin_id;
  else
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
      auth.uid (),
      now()
    )
    returning
      id into v_checkin_id;
  end if;

  perform public.record_audit (
    'session_checkin_recorded_manually',
    'discussion_session',
    p_session_id,
    v_class_id,
    jsonb_build_object('status', p_status)
  );

  return v_checkin_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Class summaries: an unopened meeting is not an absence
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_attendance_member_summary (p_class_id uuid) returns TABLE (
  user_id uuid,
  joined_at timestamptz,
  present_count bigint,
  late_count bigint,
  excused_count bigint,
  absent_count bigint,
  unrecorded_count bigint,
  pending_count bigint
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'Not allowed to view class attendance'
    USING ERRCODE = '42501';
  END IF;

  RETURN query
  SELECT
    m.user_id,
    m.joined_at,
    count(c.user_id) FILTER (
      WHERE
        c.status = 'present'
    ),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'late'
    ),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'excused'
    ),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'absent'
    ),
    count(*) FILTER (
      WHERE
        c.user_id IS NULL
        AND (s.status = 'completed' OR s.ends_at <= now())
    ),
    count(*) FILTER (
      WHERE
        c.user_id IS NULL
        AND s.status <> 'completed'
        AND s.ends_at > now()
    )
  FROM
    public.class_members m
    JOIN public.discussion_sessions s ON s.class_id = m.class_id
    AND s.status <> 'cancelled'
    AND s.starts_at <= now()
    AND s.starts_at >= m.joined_at
    AND (
      s.meeting_number IS NULL
      OR s.attendance_opened_at IS NOT NULL
    )
    LEFT JOIN public.discussion_session_checkins c ON c.session_id = s.id
    AND c.user_id = m.user_id
  WHERE
    m.class_id = p_class_id
  GROUP BY
    m.user_id,
    m.joined_at
  ORDER BY
    m.joined_at ASC;
END;
$$;


CREATE OR REPLACE FUNCTION public.class_attendance_session_summary (p_class_id uuid) returns TABLE (
  session_id uuid,
  expected_count bigint,
  present_count bigint,
  late_count bigint,
  excused_count bigint,
  absent_count bigint,
  unrecorded_count bigint,
  pending_count bigint
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'Not allowed to view class attendance'
    USING ERRCODE = '42501';
  END IF;

  RETURN query
  SELECT
    s.id,
    count(m.user_id),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'present'
    ),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'late'
    ),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'excused'
    ),
    count(c.user_id) FILTER (
      WHERE
        c.status = 'absent'
    ),
    count(*) FILTER (
      WHERE
        c.user_id IS NULL
        AND (s.status = 'completed' OR s.ends_at <= now())
    ),
    count(*) FILTER (
      WHERE
        c.user_id IS NULL
        AND s.status <> 'completed'
        AND s.ends_at > now()
    )
  FROM
    public.discussion_sessions s
    LEFT JOIN public.class_members m ON m.class_id = s.class_id
    AND m.joined_at <= s.starts_at
    LEFT JOIN public.discussion_session_checkins c ON c.session_id = s.id
    AND c.user_id = m.user_id
  WHERE
    s.class_id = p_class_id
    AND s.status <> 'cancelled'
    AND s.starts_at <= now()
    AND (
      s.meeting_number IS NULL
      OR s.attendance_opened_at IS NOT NULL
    )
  GROUP BY
    s.id,
    s.status,
    s.ends_at
  ORDER BY
    s.starts_at DESC;
END;
$$;


-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
GRANT
SELECT
  (
    subject_id,
    meeting_number,
    meeting_date,
    attendance_opens_at,
    attendance_closes_at,
    attendance_opened_at,
    attendance_closed_at,
    attendance_finalized_at,
    late_after_minutes,
    checkin_radius_m
  ) ON public.discussion_sessions TO authenticated;


GRANT
SELECT
  (
    identity_verified,
    identity_verified_at
  ) ON public.discussion_session_checkins TO authenticated;


REVOKE ALL ON function public.create_attendance_meeting (
  uuid,
  uuid,
  integer,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  integer,
  double precision,
  double precision,
  integer,
  text
)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.open_attendance_meeting (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.close_attendance_meeting (uuid, boolean)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.reopen_attendance_meeting (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.update_attendance_meeting_location (uuid, double precision, double precision, integer, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.check_in_attendance_meeting (uuid, text, text, double precision, double precision, double precision)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.attendance_meeting_roster (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.attendance_meeting_failures (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.class_attendance_roster (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.class_attendance_recap (uuid, uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.class_attendance_meeting_list (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.log_attendance_export (uuid, uuid, uuid, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.create_attendance_meeting (
  uuid,
  uuid,
  integer,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  integer,
  double precision,
  double precision,
  integer,
  text
) TO authenticated;


GRANT
EXECUTE ON function public.open_attendance_meeting (uuid) TO authenticated;


GRANT
EXECUTE ON function public.close_attendance_meeting (uuid, boolean) TO authenticated;


GRANT
EXECUTE ON function public.reopen_attendance_meeting (uuid) TO authenticated;


GRANT
EXECUTE ON function public.update_attendance_meeting_location (uuid, double precision, double precision, integer, text) TO authenticated;


GRANT
EXECUTE ON function public.check_in_attendance_meeting (uuid, text, text, double precision, double precision, double precision) TO authenticated;


GRANT
EXECUTE ON function public.attendance_meeting_roster (uuid) TO authenticated;


GRANT
EXECUTE ON function public.attendance_meeting_failures (uuid) TO authenticated;


GRANT
EXECUTE ON function public.class_attendance_roster (uuid) TO authenticated;


GRANT
EXECUTE ON function public.class_attendance_recap (uuid, uuid) TO authenticated;


GRANT
EXECUTE ON function public.class_attendance_meeting_list (uuid) TO authenticated;


GRANT
EXECUTE ON function public.log_attendance_export (uuid, uuid, uuid, text) TO authenticated;
