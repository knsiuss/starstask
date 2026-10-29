-- One-off notification queue for class and moderation events.
--
-- Reminders keep their own ledger (notification_deliveries) because they are
-- keyed by deadline and deduped per assignment. These events are point-in-time,
-- so they get a separate table with a caller-supplied dedupe key.
--
-- Payloads are sanitized JSON built inside SECURITY DEFINER functions: a title,
-- a body, and an internal URL. Invitation tokens, emails, and moderation notes
-- never enter this table.
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_events_kind_allowed check (
    kind in (
      'class_application_approved',
      'class_application_rejected',
      'class_admin_assigned',
      'class_invitation',
      'assignment_approved',
      'assignment_rejected',
      'submission_received',
      'moderation_required'
    )
  ),
  constraint notification_events_status_allowed check (
    status in ('pending', 'processing', 'sent', 'failed', 'skipped')
  ),
  constraint notification_events_attempts_range check (attempt_count between 0 and 10),
  constraint notification_events_dedupe_key unique (dedupe_key),
  constraint notification_events_dedupe_key_length check (char_length(dedupe_key) between 8 and 200),
  constraint notification_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint notification_events_payload_size check (pg_column_size(payload) <= 4096),
  constraint notification_events_error_length check (
    last_error_category is null
    or char_length(last_error_category) between 1 and 40
  )
);


comment on table public.notification_events IS 'Point-in-time push events. No tokens, emails, or moderation notes are stored in payload.';


create index if not exists notification_events_due_idx ON public.notification_events (status, next_attempt_at);


create index if not exists notification_events_user_recent_idx ON public.notification_events (user_id, created_at DESC);


create trigger notification_events_set_updated_at BEFORE
update ON public.notification_events FOR EACH ROW
execute function public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- Scheduler functions (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.claim_notification_events (p_now timestamptz, p_limit integer DEFAULT 50) returns TABLE (
  id uuid,
  user_id uuid,
  kind text,
  payload jsonb,
  attempt_count integer
) language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin -- Rows for users who turned push off (or lost every device) are useless by
-- the time they would be delivered. Skip them instead of retrying forever.
update public.notification_events e
set
  status = 'skipped',
  updated_at = v_now
where
  e.status = 'pending'
  and (
    not exists (
      select
        1
      from
        public.notification_preferences p
      where
        p.user_id = e.user_id
        and p.push_enabled
    )
    or not exists (
      select
        1
      from
        public.push_subscriptions s
      where
        s.user_id = e.user_id
        and s.disabled_at is null
    )
  );
-- A worker that crashed mid-send leaves rows in 'processing'.
update public.notification_events e
set
  status = 'pending',
  next_attempt_at = v_now,
  updated_at = v_now
where
  e.status = 'processing'
  and e.updated_at < v_now - interval '10 minutes';
return query with claimable as (
  select
    e.id
  from
    public.notification_events e
  where
    e.status = 'pending'
    and e.next_attempt_at <= v_now
  order by
    e.next_attempt_at asc,
    e.created_at asc
  limit v_limit for
  update skip locked
),
claimed as (
  update public.notification_events e
  set
    status = 'processing',
    attempt_count = e.attempt_count + 1,
    updated_at = v_now
  from
    claimable c
  where
    e.id = c.id
  returning
    e.*
)
select
  c.id,
  c.user_id,
  c.kind,
  c.payload,
  c.attempt_count
from
  claimed c;
end;
$$;


comment on function public.claim_notification_events (timestamptz, integer) IS 'Atomically claims due event rows with FOR UPDATE SKIP LOCKED. service_role only.';


create or replace function public.complete_notification_event (
  p_id uuid,
  p_status text,
  p_error_category text DEFAULT NULL,
  p_next_attempt_at timestamptz DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin if p_status not in ('sent', 'failed', 'skipped', 'pending') then raise exception 'invalid event status' using errcode = '22023';
end if;
update public.notification_events e
set
  status = p_status,
  last_error_category = case
    when p_status = 'sent' then null
    else nullif(btrim(coalesce(p_error_category, '')), '')
  end,
  sent_at = case
    when p_status = 'sent' then now()
    else e.sent_at
  end,
  next_attempt_at = coalesce(p_next_attempt_at, e.next_attempt_at),
  updated_at = now()
where
  e.id = p_id
  and e.status = 'processing';
return found;
end;
$$;


comment on function public.complete_notification_event (uuid, text, text, timestamptz) IS 'Finishes a claimed event. service_role only.';


revoke all on function public.claim_notification_events (timestamptz, integer)
from
  public,
  anon,
  authenticated;


grant
execute on function public.claim_notification_events (timestamptz, integer) to service_role;


revoke all on function public.complete_notification_event (uuid, text, text, timestamptz)
from
  public,
  anon,
  authenticated;


grant
execute on function public.complete_notification_event (uuid, text, text, timestamptz) to service_role;
