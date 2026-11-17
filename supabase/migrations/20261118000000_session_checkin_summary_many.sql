-- Phase 5K optimization: batched check-in summary for list pages.
-- Authorization stays in can_view_session; raw coordinates are never returned.
-- The old session_checkin_summary RPC remains for single-session callers.
CREATE OR REPLACE FUNCTION public.session_checkin_summary_many (p_session_ids UUID[]) returns TABLE (session_id uuid, has_location boolean, radius_m integer) language sql stable security definer
SET
  search_path = '' AS $$
select
  s.id,
  s.checkin_latitude is not null and s.checkin_longitude is not null,
  s.checkin_radius_m
from
  unnest(coalesce(p_session_ids, array[]::uuid[])) with ordinality as requested(id, ord)
  join public.discussion_sessions s
    on s.id = requested.id
where
  public.can_view_session(s.id)
group by
  s.id,
  s.checkin_latitude,
  s.checkin_longitude,
  s.checkin_radius_m
order by
  min(requested.ord);
$$;


COMMENT ON function public.session_checkin_summary_many (UUID[]) IS 'Derived check-in configuration for visible sessions, one row per distinct session. Raw coordinates stay server-side.';


REVOKE ALL ON function public.session_checkin_summary_many (UUID[])
FROM
  public;


REVOKE ALL ON function public.session_checkin_summary_many (UUID[])
FROM
  anon;


REVOKE ALL ON function public.session_checkin_summary_many (UUID[])
FROM
  authenticated;


GRANT
EXECUTE ON function public.session_checkin_summary_many (UUID[]) TO authenticated;
