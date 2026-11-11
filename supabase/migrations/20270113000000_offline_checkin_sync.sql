-- Offline-recorded check-in for attendance meetings.
--
-- A reading captured on a device without network (basement campus) is still
-- valid evidence once the phone reconnects — the satellite fix does not need
-- internet. The online RPCs cannot accept it, because their 60 second
-- freshness rule assumes the reading is used immediately. This RPC validates
-- the same invariants against the *captured* time instead:
--   * membership at captured time (joined before starts_at),
--   * meeting was open at captured time,
--   * accuracy, radius, name and NIM against the profile,
--   * the reading falls inside the attendance window as-of captured time.
-- The 60 second freshness wrapper keeps protecting online check-in; this
-- function exists only for the sync path, and rows are marked
-- method = 'offline_sync' so reviewers can tell them apart from live geo
-- check-ins.

-- 1. Allow the new method.
ALTER TABLE public.discussion_session_checkins
  DROP CONSTRAINT IF EXISTS discussion_session_checkins_method_allowed;

ALTER TABLE public.discussion_session_checkins
  ADD CONSTRAINT discussion_session_checkins_method_allowed
  CHECK (method IN ('geo', 'manual', 'offline_sync'));

COMMENT ON TABLE public.discussion_session_checkins IS 'Attendance for one session. geo rows: live GPS check-in; offline_sync rows: captured on device without network and uploaded later (validated against captured time); manual rows: organizer-recorded, no coordinates.';

-- 2. Offline sync RPC.
CREATE OR REPLACE FUNCTION public.sync_offline_attendance_meeting (
  p_session_id uuid,
  p_full_name text,
  p_nim text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz,
  p_time_from_gnss boolean DEFAULT true,
  p_device_clock_auto boolean DEFAULT true
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
  v_offline_note text;
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

  -- The reading is as old as the queue; only sanity bounds apply, never the
  -- 60 second freshness rule.
  if p_captured_at is null then
    raise exception 'Missing capture time' using errcode = '22023';
  end if;
  if p_captured_at > now () + interval '5 minutes'
  or p_captured_at < now () - interval '30 days' then
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_stale_position',
      'message', 'This offline reading is too old to trust. Ask your class admin to mark you present manually.'
    );
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

  -- The reading must have been legal at the moment it was captured.
  if v_session.attendance_opened_at is null then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'not_open');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_not_open',
      'message', 'Attendance had not been opened for this meeting.'
    );
  end if;

  if p_captured_at < v_session.attendance_opened_at then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'not_open');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_not_open',
      'message', 'This reading was captured before attendance opened.'
    );
  end if;

  if v_session.attendance_closed_at is not null
  and p_captured_at > v_session.attendance_closed_at then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'Attendance for this meeting had closed before this reading was captured.'
    );
  end if;

  if p_captured_at > coalesce(v_session.attendance_closes_at, v_session.ends_at) then
    perform public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'This reading was captured after the attendance window ended.'
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
    when p_captured_at > v_session.starts_at + make_interval (mins => v_session.late_after_minutes) then 'late'
    else 'present'
  end;

  v_offline_note :=
    'offline sync'
    || case when not coalesce(p_time_from_gnss, true) then '; capture time not from GNSS fix' else '' end
    || case when not coalesce(p_device_clock_auto, true) then '; device clock set manually at capture' else '' end;

  if v_checkin.id is not null then
    update public.discussion_session_checkins
    set
      status = v_new_status,
      method = 'offline_sync',
      latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = p_accuracy_m,
      distance_m = v_distance,
      checked_in_at = p_captured_at,
      note = v_offline_note,
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
      note,
      identity_verified,
      identity_verified_at,
      checked_in_at
    ) values (
      p_session_id,
      v_user_id,
      v_new_status,
      'offline_sync',
      p_latitude,
      p_longitude,
      p_accuracy_m,
      v_distance,
      v_offline_note,
      true,
      now(),
      p_captured_at
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
    'attendance_meeting_offline_sync',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object(
      'status', v_new_status,
      'distance_m', round(v_distance),
      'captured_at', to_char(p_captured_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'time_from_gnss', coalesce(p_time_from_gnss, true),
      'device_clock_auto', coalesce(p_device_clock_auto, true)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_checkin_id,
    'status', v_new_status,
    'checked_in_at', p_captured_at,
    'distance_m', v_distance,
    'accuracy_m', p_accuracy_m,
    'already_checked_in', false
  );
end;
$$;

REVOKE ALL ON function public.sync_offline_attendance_meeting (
  uuid, text, text, double precision, double precision, double precision, timestamptz, boolean, boolean
) FROM public, anon, authenticated;

GRANT EXECUTE ON function public.sync_offline_attendance_meeting (
  uuid, text, text, double precision, double precision, double precision, timestamptz, boolean, boolean
) TO authenticated;

COMMENT ON function public.sync_offline_attendance_meeting (uuid, text, text, double precision, double precision, double precision, timestamptz, boolean, boolean) IS 'Offline-sync check-in for attendance meetings. Validates membership, window, accuracy, radius, and identity against the captured (usually GNSS) time, never against sync time, and records the row as method = offline_sync.';
