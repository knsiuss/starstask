-- Push notification functions.
--
-- Two audiences:
--   authenticated  -> register_push_subscription()
--   service_role   -> claim_notification_deliveries(), complete_notification_delivery()
--
-- The scheduler never runs as an end user: claiming a batch across users must
-- bypass RLS, and granting that to `authenticated` would let a client read or
-- mutate other users' delivery rows.
CREATE OR REPLACE FUNCTION public.register_push_subscription (
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_user_id uuid := auth.uid();
v_id uuid;
v_label text := nullif(btrim(coalesce(p_device_label, '')), '');
begin if v_user_id is null then raise exception 'authentication required' using errcode = '42501';
end if;
if p_endpoint is null
or p_endpoint not like 'https://%'
or char_length(p_endpoint) > 2048 then raise exception 'invalid push endpoint' using errcode = '22023';
end if;
if p_p256dh is null
or char_length(p_p256dh) < 16
or p_auth is null
or char_length(p_auth) < 8 then raise exception 'invalid push keys' using errcode = '22023';
end if;
-- An endpoint is unique per browser profile. If another account already
-- registered it, the conflict update matches no row and this returns null:
-- ownership is never transferred by a re-registration.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
values (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    left(v_label, 60)
  ) on conflict (endpoint) do
update
set p256dh = excluded.p256dh,
  auth = excluded.auth,
  device_label = excluded.device_label,
  disabled_at = null
where public.push_subscriptions.user_id = v_user_id
returning id into v_id;
return v_id;
end;
$$;


COMMENT ON function public.register_push_subscription (text, text, text, text) IS 'Upserts a push subscription for the caller. Returns null when the endpoint belongs to another user.';


CREATE OR REPLACE FUNCTION public.claim_notification_deliveries (p_now timestamptz, p_limit integer DEFAULT 50) returns TABLE (
  id uuid,
  user_id uuid,
  assignment_id uuid,
  reminder_type text,
  deadline_at timestamptz,
  attempt_count integer,
  assignment_title text,
  course_name text,
  current_deadline timestamptz,
  assignment_status text,
  push_enabled boolean,
  reminder_24h boolean,
  reminder_3h boolean,
  pref_timezone text
) language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_now timestamptz := coalesce(p_now, now());
v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin -- A worker that crashed mid-send leaves rows in 'processing'. Requeue them
-- after a generous timeout so a reminder is never stuck forever.
update public.notification_deliveries d
set status = 'pending',
  next_attempt_at = v_now,
  updated_at = v_now
where d.status = 'processing'
  and d.updated_at < v_now - interval '10 minutes';
return query with claimable as (
  select d.id
  from public.notification_deliveries d
  where d.status = 'pending'
    and d.next_attempt_at <= v_now
  order by d.next_attempt_at asc,
    d.created_at asc
  limit v_limit for
  update skip locked
),
claimed as (
  update public.notification_deliveries d
  set status = 'processing',
    attempt_count = d.attempt_count + 1,
    updated_at = v_now
  from claimable c
  where d.id = c.id
  returning d.*
)
select c.id,
  c.user_id,
  c.assignment_id,
  c.reminder_type,
  c.deadline_at,
  c.attempt_count,
  a.title,
  co.name,
  a.deadline,
  a.status,
  coalesce(p.push_enabled, false),
  coalesce(p.reminder_24h, true),
  coalesce(p.reminder_3h, true),
  coalesce(p.timezone, 'Asia/Jakarta')
from claimed c
  join public.assignments a on a.id = c.assignment_id
  join public.courses co on co.id = a.course_id
  left join public.notification_preferences p on p.user_id = c.user_id;
end;
$$;


COMMENT ON function public.claim_notification_deliveries (timestamptz, integer) IS 'Atomically claims due reminder rows with FOR UPDATE SKIP LOCKED. service_role only.';


CREATE OR REPLACE FUNCTION public.list_reminder_audience (p_assignment_ids UUID[]) returns TABLE (
  assignment_id uuid,
  user_id uuid,
  pref_timezone text,
  reminder_24h boolean,
  reminder_3h boolean
) language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$ -- Owners and savers are both candidates, but only opted-in users with at
  -- least one active device. This is one round trip so the scheduler never
  -- needs to page through saved_assignments in application memory.
select a.id,
  a.user_id,
  coalesce(p.timezone, 'Asia/Jakarta'),
  coalesce(p.reminder_24h, true),
  coalesce(p.reminder_3h, true)
from public.assignments a
  join public.notification_preferences p on p.user_id = a.user_id
where a.id = any (p_assignment_ids)
  and p.push_enabled
  and exists (
    select 1
    from public.push_subscriptions s
    where s.user_id = a.user_id
      and s.disabled_at is null
  )
union
select sa.assignment_id,
  sa.user_id,
  coalesce(p.timezone, 'Asia/Jakarta'),
  coalesce(p.reminder_24h, true),
  coalesce(p.reminder_3h, true)
from public.saved_assignments sa
  join public.notification_preferences p on p.user_id = sa.user_id
where sa.assignment_id = any (p_assignment_ids)
  and p.push_enabled
  and exists (
    select 1
    from public.push_subscriptions s
    where s.user_id = sa.user_id
      and s.disabled_at is null
  );
$$;


COMMENT ON function public.list_reminder_audience (UUID[]) IS 'Opted-in owners and savers with an active device. service_role only.';


CREATE OR REPLACE FUNCTION public.complete_notification_delivery (
  p_id uuid,
  p_status text,
  p_error_category text DEFAULT NULL,
  p_next_attempt_at timestamptz DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin -- 'pending' is a deliberate requeue after a transient send failure; the row
  -- keeps its attempt_count so retries stay bounded.
  if p_status not in ('sent', 'failed', 'skipped', 'pending') then raise exception 'invalid delivery status' using errcode = '22023';
end if;
update public.notification_deliveries d
set status = p_status,
  last_error_category = case
    when p_status = 'sent' then null
    else nullif(btrim(coalesce(p_error_category, '')), '')
  end,
  delivered_at = case
    when p_status = 'sent' then now()
    else d.delivered_at
  end,
  next_attempt_at = coalesce(p_next_attempt_at, d.next_attempt_at),
  updated_at = now()
where d.id = p_id
  and d.status = 'processing';
return found;
end;
$$;


COMMENT ON function public.complete_notification_delivery (uuid, text, text, timestamptz) IS 'Finishes a claimed reminder. service_role only.';


REVOKE ALL ON function public.register_push_subscription (text, text, text, text)
FROM
  public;


GRANT
EXECUTE ON function public.register_push_subscription (text, text, text, text) TO authenticated;


REVOKE ALL ON function public.claim_notification_deliveries (timestamptz, integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.claim_notification_deliveries (timestamptz, integer) TO service_role;


REVOKE ALL ON function public.list_reminder_audience (UUID[])
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.list_reminder_audience (UUID[]) TO service_role;


REVOKE ALL ON function public.complete_notification_delivery (uuid, text, text, timestamptz)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.complete_notification_delivery (uuid, text, text, timestamptz) TO service_role;
