-- The session detail page needs the check-in radius and whether a check-in
-- point exists, but the raw coordinates are deliberately not granted to
-- clients. Selecting them directly fails with 42501 for every signed-in user,
-- so this SECURITY DEFINER helper exposes only the derived values and
-- re-checks visibility. No column grant is widened.
CREATE OR REPLACE FUNCTION public.session_checkin_summary (p_session_id uuid) returns TABLE (has_location boolean, radius_m integer) language sql stable security definer
SET
  search_path = '' AS $$
select
  s.checkin_latitude is not null
  and s.checkin_longitude is not null,
  s.checkin_radius_m
from
  public.discussion_sessions s
where
  s.id = p_session_id
  and public.can_view_session (p_session_id);
$$;


COMMENT ON function public.session_checkin_summary (uuid) IS 'Derived check-in configuration for a visible session. Raw coordinates stay server-side.';


GRANT
EXECUTE ON function public.session_checkin_summary (uuid) TO anon;


GRANT
EXECUTE ON function public.session_checkin_summary (uuid) TO authenticated;
