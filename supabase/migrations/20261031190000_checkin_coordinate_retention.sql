-- Coordinate retention for attendance check-ins.
--
-- `discussion_session_checkins.latitude` / `longitude` exist only so an
-- organizer can review a disputed row. They are personal data and should not be
-- kept forever. This migration adds a purge marker and a service_role-only
-- function that clears the coordinates once the session ended outside the
-- retention window.
--
-- What is kept: status, method, checked_in_at, accuracy_m, distance_m, note,
-- reviewer fields. The row still shows that the check-in happened and how far
-- away it was; only the exact position is removed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.discussion_session_checkins
ADD COLUMN IF NOT EXISTS coordinates_purged_at timestamptz;


COMMENT ON COLUMN public.discussion_session_checkins.coordinates_purged_at IS 'Set when latitude/longitude were removed by retention. NULL means the coordinates, when present, are still stored.';


-- A geo row normally needs its reading. After a purge the columns are gone by
-- design, so the marker is the exception that keeps the row valid without
-- pretending it was recorded manually.
ALTER TABLE public.discussion_session_checkins
DROP CONSTRAINT IF EXISTS discussion_session_checkins_geo_fields;


ALTER TABLE public.discussion_session_checkins
ADD CONSTRAINT discussion_session_checkins_geo_fields CHECK (
  method = 'manual'
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


CREATE INDEX IF NOT EXISTS discussion_session_checkins_retention_idx ON public.discussion_session_checkins (session_id)
WHERE
  latitude IS NOT NULL
  AND coordinates_purged_at IS NULL;


-- ---------------------------------------------------------------------------
-- purge_discussion_checkin_coordinates
--
-- Bounded to 5,000 rows per call so a long-neglected deployment does not hold a
-- large update lock. The scheduler runs it repeatedly until the count is zero.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_discussion_checkin_coordinates (p_retention_days integer DEFAULT 30) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_retention_days integer := coalesce(p_retention_days, 30);
  v_count integer;
BEGIN
  IF v_retention_days < 1 OR v_retention_days > 3650 THEN
    RAISE EXCEPTION 'Retention must be between 1 and 3650 days'
    USING ERRCODE = '22023';
  END IF;

  WITH eligible AS (
    SELECT
      c.id
    FROM
      public.discussion_session_checkins c
      JOIN public.discussion_sessions s ON s.id = c.session_id
    WHERE
      c.latitude IS NOT NULL
      AND c.coordinates_purged_at IS NULL
      AND s.ends_at < now() - make_interval(days => v_retention_days)
    ORDER BY
      s.ends_at ASC
    LIMIT
      5000
  ), purged AS (
    UPDATE public.discussion_session_checkins c
    SET
      latitude = NULL,
      longitude = NULL,
      coordinates_purged_at = now(),
      updated_at = now()
    WHERE
      c.id IN (
        SELECT
          eligible.id
        FROM
          eligible
      )
    RETURNING
      c.id
  )
  SELECT
    count(*) INTO v_count
  FROM
    purged;

  RETURN v_count;
END;
$$;


COMMENT ON function public.purge_discussion_checkin_coordinates (integer) IS 'Clears latitude/longitude for check-ins whose session ended more than the retention window ago. Keeps status, distance, and accuracy. Service role only.';


REVOKE ALL ON function public.purge_discussion_checkin_coordinates (integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.purge_discussion_checkin_coordinates (integer) TO service_role;
