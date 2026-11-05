-- Grouped Action Center counts: 4 x N head counts -> 1 RPC roundtrip.
-- Authorization is re-checked inside the function: is_class_admin() derives
-- the caller from auth.uid(), so a caller cannot read counts for a class it
-- does not administer by passing arbitrary ids. Counts mirror the legacy
-- per-class queries in apps/web/src/lib/db/class-actions.ts exactly.
CREATE OR REPLACE FUNCTION public.get_class_action_counts (p_class_ids UUID[], p_from timestamptz, p_to timestamptz) RETURNS TABLE (
  class_id uuid,
  pending_submissions bigint,
  pending_leave bigint,
  todays_sessions bigint,
  open_reports bigint
) LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  WITH requested AS (
    SELECT DISTINCT u.id
    FROM unnest(COALESCE(p_class_ids, ARRAY[]::uuid[])) AS u(id)
    WHERE public.is_class_admin(u.id)
  ),
  submissions AS (
    SELECT a.class_id, COUNT(*)::bigint AS cnt
    FROM public.assignments a
    JOIN requested r ON r.id = a.class_id
    WHERE a.status = 'pending_review'
    GROUP BY a.class_id
  ),
  leave_queue AS (
    SELECT l.class_id, COUNT(*)::bigint AS cnt
    FROM public.leave_requests l
    JOIN requested r ON r.id = l.class_id
    WHERE l.status = 'submitted'
    GROUP BY l.class_id
  ),
  sessions AS (
    SELECT s.class_id, COUNT(*)::bigint AS cnt
    FROM public.discussion_sessions s
    JOIN requested r ON r.id = s.class_id
    WHERE s.status = 'scheduled'
      AND s.starts_at >= p_from
      AND s.starts_at < p_to
    GROUP BY s.class_id
  ),
  reports AS (
    SELECT rp.class_id, COUNT(*)::bigint AS cnt
    FROM public.assignment_reports rp
    JOIN requested r ON r.id = rp.class_id
    WHERE rp.status = 'open'
    GROUP BY rp.class_id
  )
  SELECT
    r.id,
    COALESCE(sub.cnt, 0),
    COALESCE(lv.cnt, 0),
    COALESCE(ss.cnt, 0),
    COALESCE(rp.cnt, 0)
  FROM requested r
  LEFT JOIN submissions sub ON sub.class_id = r.id
  LEFT JOIN leave_queue lv ON lv.class_id = r.id
  LEFT JOIN sessions ss ON ss.class_id = r.id
  LEFT JOIN reports rp ON rp.class_id = r.id;
$$;


REVOKE ALL ON FUNCTION public.get_class_action_counts (UUID[], timestamptz, timestamptz)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.get_class_action_counts (UUID[], timestamptz, timestamptz) TO authenticated;


COMMENT ON FUNCTION public.get_class_action_counts (UUID[], timestamptz, timestamptz) IS 'Grouped Action Center counts in 1 roundtrip; only classes the caller administers are returned.';


-- Distinct semesters of published assignments without fetching up to 1000 rows
-- to dedupe in the app (getSemesterOptions in lib/db/assignments.ts).
-- Semester labels of published assignments are public browse data.
CREATE OR REPLACE FUNCTION public.list_published_semesters () RETURNS TABLE (semester text) LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT DISTINCT a.semester
  FROM public.assignments a
  WHERE a.status = 'published'
    AND a.semester IS NOT NULL
  ORDER BY a.semester;
$$;


REVOKE ALL ON FUNCTION public.list_published_semesters ()
FROM
  public;


GRANT
EXECUTE ON FUNCTION public.list_published_semesters () TO anon,
authenticated;


COMMENT ON FUNCTION public.list_published_semesters () IS 'Distinct semester labels on published assignments, deduped in the database.';
