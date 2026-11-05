-- Database optimization batch: index, grouped metrics, batched notify, and
-- server-side developer directory. All changes preserve existing function
-- signatures and output shapes.
-- 1. class_invitation_acceptances is queried by user first
-- (dashboard.ts: .eq("user_id").in("invitation_id")), but the only unique key
-- leads with invitation_id, so user-scoped lookups cannot use it.
CREATE INDEX IF NOT EXISTS class_invitation_acceptances_user_invitation_idx ON public.class_invitation_acceptances (user_id, invitation_id);


-- 2. developer_class_metrics: correlated subqueries -> grouped aggregates.
-- Same columns, same ordering (member_count DESC, name ASC), same limit clamp.
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
WITH members AS (
  SELECT m.class_id, count(*)::bigint AS cnt
  FROM public.class_members m
  GROUP BY m.class_id
),
admins AS (
  SELECT a.class_id, count(*)::bigint AS cnt
  FROM public.class_admins a
  GROUP BY a.class_id
),
assignments_agg AS (
  SELECT
    p.class_id,
    count(*) FILTER (WHERE p.status = 'published')::bigint AS published_cnt,
    count(*) FILTER (WHERE p.status = 'pending_review')::bigint AS pending_cnt,
    max(p.created_at) AS last_at
  FROM public.assignments p
  GROUP BY p.class_id
),
sessions_agg AS (
  SELECT
    s.class_id,
    count(*)::bigint AS cnt,
    max(s.created_at) AS last_at
  FROM public.discussion_sessions s
  GROUP BY s.class_id
),
attendance AS (
  SELECT s.class_id, count(*)::bigint AS cnt
  FROM public.discussion_session_checkins ch
  JOIN public.discussion_sessions s ON s.id = ch.session_id
  GROUP BY s.class_id
),
leaves AS (
  SELECT l.class_id, count(*)::bigint AS cnt
  FROM public.leave_requests l
  GROUP BY l.class_id
),
invitations AS (
  SELECT i.class_id, count(*)::bigint AS cnt
  FROM public.class_invitations i
  GROUP BY i.class_id
)
SELECT
  c.id,
  c.name,
  c.class_code,
  c.status,
  c.academic_year,
  c.semester,
  coalesce(m.cnt, 0),
  coalesce(a.cnt, 0),
  coalesce(pa.published_cnt, 0),
  coalesce(pa.pending_cnt, 0),
  coalesce(sa.cnt, 0),
  coalesce(at.cnt, 0),
  coalesce(l.cnt, 0),
  coalesce(i.cnt, 0),
  greatest(
    c.updated_at,
    coalesce(pa.last_at, c.updated_at),
    coalesce(sa.last_at, c.updated_at)
  )
FROM public.classes c
LEFT JOIN members m ON m.class_id = c.id
LEFT JOIN admins a ON a.class_id = c.id
LEFT JOIN assignments_agg pa ON pa.class_id = c.id
LEFT JOIN sessions_agg sa ON sa.class_id = c.id
LEFT JOIN attendance at ON at.class_id = c.id
LEFT JOIN leaves l ON l.class_id = c.id
LEFT JOIN invitations i ON i.class_id = c.id
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


-- 3. notify_session_participants: per-participant function calls -> one
-- batched insert. enqueue_notification_event is currently a null check plus
-- an insert with ON CONFLICT DO NOTHING, so the batched insert below is
-- equivalent. The return value keeps the legacy meaning: distinct
-- participants attempted, not rows actually inserted.
CREATE OR REPLACE FUNCTION public.notify_session_participants (
  p_session_id uuid,
  p_kind text,
  p_dedupe_prefix text,
  p_title text,
  p_body text,
  p_url text
) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_count integer := 0;
begin
  SELECT count(*) INTO v_count
  FROM (
    SELECT DISTINCT r.user_id
    FROM public.discussion_session_rsvps r
    WHERE r.session_id = p_session_id
      AND r.status IN ('going', 'maybe')
      AND r.user_id IS NOT NULL
  ) participants;

  INSERT INTO public.notification_events (user_id, kind, dedupe_key, payload)
  SELECT DISTINCT
    r.user_id,
    p_kind,
    p_dedupe_prefix || ':' || r.user_id::text,
    jsonb_build_object(
      'title',
      left(p_title, 120),
      'body',
      left(p_body, 240),
      'url',
      p_url
    )
  FROM public.discussion_session_rsvps r
  WHERE r.session_id = p_session_id
    AND r.status IN ('going', 'maybe')
    AND r.user_id IS NOT NULL
  ON CONFLICT (dedupe_key) DO NOTHING;

  return v_count;
end;
$$;


-- 4. developer_list_users: search/sort/paginate auth users in SQL instead of
-- fetching every auth user into memory. Mirrors the legacy JS semantics:
-- name = full_name else name from user_metadata, case-insensitive substring
-- search, null dates sort as epoch. Emails are never returned.
-- service_role only, like developer_class_metrics.
CREATE OR REPLACE FUNCTION public.developer_list_users (
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_direction text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
) RETURNS TABLE (
  id uuid,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
) LANGUAGE sql SECURITY DEFINER STABLE
SET
  search_path = '' AS $$
WITH filtered AS (
  SELECT
    u.id,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
    ) AS display_name,
    u.created_at,
    u.last_sign_in_at,
    CASE WHEN p_sort = 'last_sign_in_at' THEN u.last_sign_in_at ELSE u.created_at END AS sort_key,
    count(*) OVER () AS total_count
  FROM auth.users u
  WHERE p_search IS NULL
    OR p_search = ''
    OR lower(
      coalesce(
        nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
      )
    ) LIKE '%' || lower(p_search) || '%'
)
SELECT
  f.id,
  f.display_name,
  f.created_at,
  f.last_sign_in_at,
  f.total_count
FROM filtered f
ORDER BY
  CASE WHEN p_direction = 'asc' THEN coalesce(f.sort_key, '-infinity'::timestamptz) END ASC,
  CASE WHEN p_direction = 'desc' THEN coalesce(f.sort_key, '-infinity'::timestamptz) END DESC,
  f.id ASC
OFFSET greatest(coalesce(p_page, 1) - 1, 0) * least(greatest(coalesce(p_page_size, 25), 1), 200)
LIMIT least(greatest(coalesce(p_page_size, 25), 1), 200);
$$;


COMMENT ON FUNCTION public.developer_list_users (text, text, text, integer, integer) IS 'Developer user directory with server-side search/sort/pagination. No emails. service_role only.';


REVOKE ALL ON FUNCTION public.developer_list_users (text, text, text, integer, integer)
FROM
  PUBLIC,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.developer_list_users (text, text, text, integer, integer) TO service_role;
