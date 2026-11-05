-- Phase 5K optimization: batched check-in summary for list pages.
-- Authorization stays in can_view_session; raw coordinates are never returned.
-- The old session_checkin_summary RPC remains for single-session callers.

create or replace function public.session_checkin_summary_many(
  p_session_ids uuid[]
)
returns table(
  session_id uuid,
  has_location boolean,
  radius_m integer
)
language sql
stable
security definer
set search_path = ''
as $$
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

comment on function public.session_checkin_summary_many(uuid[]) is
  'Derived check-in configuration for visible sessions, one row per distinct session. Raw coordinates stay server-side.';

revoke all on function public.session_checkin_summary_many(uuid[]) from public;
revoke all on function public.session_checkin_summary_many(uuid[]) from anon;
revoke all on function public.session_checkin_summary_many(uuid[]) from authenticated;
grant execute on function public.session_checkin_summary_many(uuid[]) to authenticated;
