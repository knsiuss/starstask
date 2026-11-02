-- Aggregate per-class metrics for the developer console.
--
-- The console already reports platform-wide counters. This function adds one row
-- per class without exposing member identities, emails, student IDs, leave
-- details, or evidence. Only counts and class metadata leave the database.
--
-- Access is service_role only: the page that calls it is gated by the developer
-- email allowlist, and no client role may execute the function directly.
CREATE OR REPLACE FUNCTION public.developer_class_metrics (p_limit integer DEFAULT 200) RETURNS TABLE (
  class_id uuid,
  name text,
  class_code text,
  status text,
  academic_year text,
  semester text,
  member_count bigint,
  admin_count bigint,
  published_count bigint,
  pending_review_count bigint,
  session_count bigint,
  attendance_count bigint,
  leave_request_count bigint,
  invitation_count bigint,
  last_activity_at timestamptz
) LANGUAGE sql SECURITY DEFINER STABLE
SET
  search_path = public,
  pg_temp AS $$
SELECT
  c.id,
  c.name,
  c.class_code,
  c.status,
  c.academic_year,
  c.semester,
  (SELECT count(*) FROM public.class_members m WHERE m.class_id = c.id),
  (SELECT count(*) FROM public.class_admins a WHERE a.class_id = c.id),
  (
    SELECT count(*)
    FROM public.assignments p
    WHERE p.class_id = c.id AND p.status = 'published'
  ),
  (
    SELECT count(*)
    FROM public.assignments p
    WHERE p.class_id = c.id AND p.status = 'pending_review'
  ),
  (SELECT count(*) FROM public.discussion_sessions s WHERE s.class_id = c.id),
  (
    SELECT count(*)
    FROM public.discussion_session_checkins ch
    JOIN public.discussion_sessions s ON s.id = ch.session_id
    WHERE s.class_id = c.id
  ),
  (SELECT count(*) FROM public.leave_requests l WHERE l.class_id = c.id),
  (SELECT count(*) FROM public.class_invitations i WHERE i.class_id = c.id),
  greatest(
    c.updated_at,
    coalesce(
      (SELECT max(p.created_at) FROM public.assignments p WHERE p.class_id = c.id),
      c.updated_at
    ),
    coalesce(
      (SELECT max(s.created_at) FROM public.discussion_sessions s WHERE s.class_id = c.id),
      c.updated_at
    )
  )
FROM
  public.classes c
ORDER BY
  7 DESC,
  c.name ASC
LIMIT least(greatest(coalesce(p_limit, 200), 1), 500);
$$;


COMMENT ON FUNCTION public.developer_class_metrics (integer) IS 'Aggregate per-class counts for /developer/classes. No personal data. service_role only.';


REVOKE ALL ON FUNCTION public.developer_class_metrics (integer)
FROM
  PUBLIC,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.developer_class_metrics (integer) TO service_role;
