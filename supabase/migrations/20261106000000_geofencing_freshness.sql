-- Strict geofencing: reject a stale browser position reading.
--
-- A browser may cache a fix, so the client sends the reading's own timestamp
-- (`capturedAt`) next to the coordinates. Both check-in RPCs reject a reading
-- older than 60 seconds (or stamped in the future) before the radius check.
-- These are thin overloads: they validate freshness, then delegate to the
-- existing functions so window, accuracy, distance, membership, and duplicate
-- handling stay in one place. A null `p_captured_at` keeps old clients valid.
CREATE OR REPLACE FUNCTION public.check_in_discussion_session (
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz
) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if p_captured_at is not null
  and (
    p_captured_at > now () + interval '60 seconds'
    or p_captured_at < now () - interval '60 seconds'
  ) then
    raise exception 'Your location is stale. Move somewhere with a clearer signal and try again' using errcode = 'SS106';
  end if;

  return public.check_in_discussion_session (
    p_session_id,
    p_latitude,
    p_longitude,
    p_accuracy_m
  );
end;
$$;


CREATE OR REPLACE FUNCTION public.check_in_attendance_meeting (
  p_session_id uuid,
  p_full_name text,
  p_nim text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz
) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if p_captured_at is not null
  and (
    p_captured_at > now () + interval '60 seconds'
    or p_captured_at < now () - interval '60 seconds'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'checkin_stale_position',
      'message', 'Your location is stale. Move somewhere with a clearer signal and try again.'
    );
  end if;

  return public.check_in_attendance_meeting (
    p_session_id,
    p_full_name,
    p_nim,
    p_latitude,
    p_longitude,
    p_accuracy_m
  );
end;
$$;


REVOKE ALL ON function public.check_in_discussion_session (
  uuid,
  double precision,
  double precision,
  double precision,
  timestamptz
)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.check_in_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.check_in_discussion_session (
  uuid,
  double precision,
  double precision,
  double precision,
  timestamptz
) TO authenticated;


GRANT
EXECUTE ON function public.check_in_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
) TO authenticated;


COMMENT ON function public.check_in_discussion_session (
  uuid,
  double precision,
  double precision,
  double precision,
  timestamptz
) IS 'Freshness-checked wrapper over the 4-argument check-in. A capturedAt older than 60 seconds (or in the future) is rejected with SS106 before the radius check.';


COMMENT ON function public.check_in_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
) IS 'Freshness-checked wrapper over the 6-argument meeting check-in. A capturedAt older than 60 seconds (or in the future) returns checkin_stale_position before identity and radius checks.';
