-- Class attendance summaries for class admins.
--
-- Aggregating in Postgres keeps the numbers exact even when a class has more
-- check-in rows than one PostgREST response may return. Both functions are
-- SECURITY DEFINER because they read every member's rows, which is exactly the
-- data RLS hides from students; the role check below is therefore the entire
-- authorization boundary and must stay.
--
-- Policy mirrored from `summarizeAttendance` in the web app:
--   * eligible = present + late + absent + unrecorded
--   * excused sessions leave the denominator
--   * pending sessions are not counted
--   * a session only counts for a member who had joined before it started.
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


COMMENT ON function public.class_attendance_member_summary (uuid) IS 'Per-member attendance counts for one class. Class managers only; a session counts only when the member had already joined.';


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
  GROUP BY
    s.id,
    s.status,
    s.ends_at
  ORDER BY
    s.starts_at DESC;
END;
$$;


COMMENT ON function public.class_attendance_session_summary (uuid) IS 'Per-session attendance counts for one class. Class managers only. A member who joined after the session started is not counted for it.';


-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON function public.class_attendance_member_summary (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.class_attendance_session_summary (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.class_attendance_member_summary (uuid) TO authenticated;


GRANT
EXECUTE ON function public.class_attendance_session_summary (uuid) TO authenticated;
