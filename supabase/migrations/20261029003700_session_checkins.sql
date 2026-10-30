-- Location check-in for in-person sessions.
--
-- A check-in is evidence, not proof: coordinates arrive from the browser and a
-- determined client can fake them. Everything the server *can* decide is decided
-- here instead of in the UI, so a crafted request cannot widen the radius, move
-- the window, or check somebody else in.
--
-- The check-in window is derived from the session itself (opens 15 minutes
-- before the start, closes at the end), so editing the schedule can never leave
-- a stale window behind.
-- ---------------------------------------------------------------------------
-- Session location
-- ---------------------------------------------------------------------------
ALTER TABLE public.discussion_sessions
  ADD COLUMN IF NOT EXISTS checkin_latitude double precision,
  ADD COLUMN IF NOT EXISTS checkin_longitude double precision,
  ADD COLUMN IF NOT EXISTS checkin_radius_m integer NOT NULL DEFAULT 150;


ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_checkin_point;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_checkin_point CHECK (
    (checkin_latitude IS NULL AND checkin_longitude IS NULL)
    OR (
      checkin_latitude BETWEEN -90 AND 90
      AND checkin_longitude BETWEEN -180 AND 180
    )
  );


ALTER TABLE public.discussion_sessions DROP CONSTRAINT IF EXISTS discussion_sessions_checkin_radius;


ALTER TABLE public.discussion_sessions
  ADD CONSTRAINT discussion_sessions_checkin_radius CHECK (checkin_radius_m BETWEEN 25 AND 1000);


-- ---------------------------------------------------------------------------
-- discussion_session_checkins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_session_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  session_id uuid NOT NULL REFERENCES public.discussion_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  method text NOT NULL DEFAULT 'geo',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  -- Kept for dispute review only: the column grant below never exposes them to
  -- a client, so a manager sees distance and accuracy, not a home address.
  -- Null for a manual row recorded by an organizer who had no reading.
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  note text,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discussion_session_checkins_status_allowed CHECK (
    status IN ('present', 'late', 'excused', 'absent')
  ),
  CONSTRAINT discussion_session_checkins_method_allowed CHECK (method IN ('geo', 'manual')),
  CONSTRAINT discussion_session_checkins_accuracy CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  CONSTRAINT discussion_session_checkins_distance CHECK (distance_m IS NULL OR distance_m >= 0),
  -- A geo row without a reading cannot be reviewed or disputed, so it is not a
  -- valid record. A manual row is the only kind allowed to lack coordinates.
  CONSTRAINT discussion_session_checkins_geo_fields CHECK (
    method = 'manual'
    OR (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND accuracy_m IS NOT NULL
      AND distance_m IS NOT NULL
    )
  ),
  CONSTRAINT discussion_session_checkins_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) BETWEEN 1 AND 500
  ),
  -- One row per participant; a retry updates nothing and returns the first one.
  CONSTRAINT discussion_session_checkins_one_per_user UNIQUE (session_id, user_id)
);


COMMENT ON TABLE public.discussion_session_checkins IS 'Attendance for one session. Geo rows come from check_in_discussion_session(); manual rows from record_discussion_session_checkin(). Coordinates support dispute review and are not granted to clients.';


CREATE INDEX IF NOT EXISTS discussion_session_checkins_session_idx ON public.discussion_session_checkins (session_id, status, checked_in_at);


CREATE INDEX IF NOT EXISTS discussion_session_checkins_user_idx ON public.discussion_session_checkins (user_id, checked_in_at DESC);


-- ---------------------------------------------------------------------------
-- distance_meters: haversine, no PostGIS dependency
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distance_meters (
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
) returns double precision language sql immutable
SET
  search_path = public,
  pg_temp AS $$
select
  6371000 * 2 * asin(
    least(
      1.0,
      sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2), 2)
        + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
      )
    )
  );
$$;


COMMENT ON function public.distance_meters (double precision, double precision, double precision, double precision) IS 'Great-circle distance in metres. Internal helper for check-in; not callable by clients.';


-- ---------------------------------------------------------------------------
-- set_discussion_session_checkin_location
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
  v_class_id uuid;
  v_type text;
  v_status text;
begin
  select
    s.class_id,
    s.session_type,
    s.status into v_class_id,
    v_type,
    v_status
  from
    public.discussion_sessions s
  where
    s.id = p_session_id;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'Not allowed to change check-in for this session' using errcode = '42501';
  end if;

  if v_type <> 'in_person' then
    raise exception 'Only in-person sessions can have a check-in location' using errcode = '22023';
  end if;

  -- Setting a point after the session ended would only confuse the record.
  if v_status <> 'scheduled' then
    raise exception 'Check-in can only be configured on a scheduled session' using errcode = '22023';
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
    v_class_id,
    jsonb_build_object('radius_m', p_radius_m)
  );

  return true;
end;
$$;


COMMENT ON function public.set_discussion_session_checkin_location (uuid, double precision, double precision, integer) IS 'Stores where an in-person session accepts check-in. Organizers only.';


-- ---------------------------------------------------------------------------
-- clear_discussion_session_checkin_location
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_discussion_session_checkin_location (p_session_id uuid) returns boolean language plpgsql security definer
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
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'Not allowed to change check-in for this session' using errcode = '42501';
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
    v_class_id,
    '{}'::jsonb
  );

  return true;
end;
$$;


-- ---------------------------------------------------------------------------
-- check_in_discussion_session
-- ---------------------------------------------------------------------------
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
  v_session_type text;
  v_session_status text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_point_lat double precision;
  v_point_lon double precision;
  v_radius_m integer;
  v_distance double precision;
  v_checkin public.discussion_session_checkins%rowtype;
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

  -- A weak fix is worse than no fix: it can put the reader in the wrong
  -- building and still pass the radius check.
  if p_accuracy_m is null or p_accuracy_m < 0 then
    raise exception 'Turn on precise location and try again' using errcode = 'SS104';
  end if;

  if p_accuracy_m > 100 then
    raise exception 'Location accuracy is too weak. Move somewhere with a clearer signal and try again' using errcode = 'SS104';
  end if;

  select
    s.class_id,
    s.session_type,
    s.status,
    s.starts_at,
    s.ends_at,
    s.checkin_latitude,
    s.checkin_longitude,
    s.checkin_radius_m into v_class_id,
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

  -- A row an organizer already reviewed wins. An unreviewed manual row (for
  -- example "absent" written before the room filled) is upgraded to a real
  -- reading below instead of being silently ignored.
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

  -- Ten minutes after the start counts as late; the organizer can still change
  -- the status afterwards.
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
      -- The organizer's placeholder no longer applies; the real reading wins.
      note = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
    where
      id = v_checkin.id
    returning id into v_checkin_id;
  else
    insert into public.discussion_session_checkins (
      session_id, user_id, status, method, latitude, longitude, accuracy_m, distance_m
    ) values (
      p_session_id, v_user_id, v_new_status, 'geo', p_latitude, p_longitude, p_accuracy_m, v_distance
    )
    on conflict (session_id, user_id) do nothing
    returning id into v_checkin_id;
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


COMMENT ON function public.check_in_discussion_session (uuid, double precision, double precision, double precision) IS 'Records the caller at a session, after checking the window, accuracy, distance, and class membership. Already checked in returns the existing row.';


-- ---------------------------------------------------------------------------
-- review_discussion_session_checkin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_discussion_session_checkin (
  p_session_id uuid,
  p_checkin_id uuid,
  p_status text,
  p_note text DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_session_id uuid;
  v_class_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('present', 'late', 'excused', 'absent') then
    raise exception 'Unknown attendance status' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023';
  end if;

  select
    c.session_id,
    s.class_id into v_session_id,
    v_class_id
  from
    public.discussion_session_checkins c
    join public.discussion_sessions s on s.id = c.session_id
  where
    c.id = p_checkin_id
    and c.session_id = p_session_id;

  if not found then
    raise exception 'Check-in not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'Not allowed to review this check-in' using errcode = '42501';
  end if;

  update public.discussion_session_checkins
  set
    status = p_status,
    note = v_note,
    reviewed_by = auth.uid (),
    reviewed_at = now(),
    updated_at = now()
  where
    id = p_checkin_id;

  perform public.record_audit (
    'session_checkin_reviewed',
    'discussion_session',
    v_session_id,
    v_class_id,
    jsonb_build_object('status', p_status)
  );

  return true;
end;
$$;


COMMENT ON function public.review_discussion_session_checkin (uuid, uuid, text, text) IS 'Overrides one attendance row. Class organizers only; every change is audited.';


-- ---------------------------------------------------------------------------
-- record_discussion_session_checkin
-- ---------------------------------------------------------------------------
-- Fallback for a participant whose browser could not provide a location, and
-- for marking somebody absent who never checked in. The row is written as
-- `manual` with no coordinates, so the record never pretends to be a geo check.
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
    s.class_id into v_class_id
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

  -- A manager can only mark people who actually belong to the class, otherwise
  -- the function would be a way to write rows about arbitrary users.
  if not exists (
    select
      1
    from
      public.class_members m
    where
      m.class_id = v_class_id
      and m.user_id = p_user_id
  ) then
    raise exception 'That user is not a member of this class' using errcode = '22023';
  end if;

  -- A manual row is a record, not a review, so `reviewed_at` stays null until
  -- an organizer changes an existing self check-in. That keeps the "unreviewed
  -- placeholder" upgrade in check_in_discussion_session reachable.
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
      session_id, user_id, status, method, note, reviewed_by
    ) values (
      p_session_id, p_user_id, p_status, 'manual', v_note, auth.uid ()
    )
    returning id into v_checkin_id;
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


COMMENT ON function public.record_discussion_session_checkin (uuid, uuid, text, text) IS 'Records or overrides attendance without coordinates. Class organizers only, and only for class members.';


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.discussion_session_checkins enable ROW LEVEL SECURITY;


-- A participant sees their own row. Organizers see everyone in the sessions they
-- run, which is what the attendance list needs.
DROP POLICY if EXISTS discussion_session_checkins_select ON public.discussion_session_checkins;


CREATE POLICY discussion_session_checkins_select ON public.discussion_session_checkins FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_organize_class_sessions (public.session_class_id (session_id))
  );


-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.discussion_session_checkins
FROM
  anon,
  authenticated;


-- No latitude/longitude: distance and accuracy are enough to review a row, and
-- an exact position is the most sensitive part of the record.
GRANT
SELECT
  (
    id,
    session_id,
    user_id,
    status,
    method,
    checked_in_at,
    accuracy_m,
    distance_m,
    note,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  ) ON public.discussion_session_checkins TO authenticated;


REVOKE ALL ON function public.distance_meters (double precision, double precision, double precision, double precision)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.set_discussion_session_checkin_location (uuid, double precision, double precision, integer)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.clear_discussion_session_checkin_location (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.check_in_discussion_session (uuid, double precision, double precision, double precision)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.review_discussion_session_checkin (uuid, uuid, text, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.record_discussion_session_checkin (uuid, uuid, text, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.set_discussion_session_checkin_location (uuid, double precision, double precision, integer) TO authenticated;


GRANT
EXECUTE ON function public.clear_discussion_session_checkin_location (uuid) TO authenticated;


GRANT
EXECUTE ON function public.check_in_discussion_session (uuid, double precision, double precision, double precision) TO authenticated;


GRANT
EXECUTE ON function public.review_discussion_session_checkin (uuid, uuid, text, text) TO authenticated;


GRANT
EXECUTE ON function public.record_discussion_session_checkin (uuid, uuid, text, text) TO authenticated;
