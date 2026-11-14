-- One-off notification queue for class and moderation events.
--
-- Reminders keep their own ledger (notification_deliveries) because they are
-- keyed by deadline and deduped per assignment. These events are point-in-time,
-- so they get a separate table with a caller-supplied dedupe key.
--
-- Payloads are sanitized JSON built inside SECURITY DEFINER functions: a title,
-- a body, and an internal URL. Invitation tokens, emails, and moderation notes
-- never enter this table.
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT notification_events_kind_allowed CHECK (
    kind IN (
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
  CONSTRAINT notification_events_status_allowed CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'skipped')
  ),
  CONSTRAINT notification_events_attempts_range CHECK (attempt_count BETWEEN 0 AND 10),
  CONSTRAINT notification_events_dedupe_key UNIQUE (dedupe_key),
  CONSTRAINT notification_events_dedupe_key_length CHECK (char_length(dedupe_key) BETWEEN 8 AND 200),
  CONSTRAINT notification_events_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT notification_events_payload_size CHECK (pg_column_size(payload) <= 4096),
  CONSTRAINT notification_events_error_length CHECK (
    last_error_category IS NULL
    OR char_length(last_error_category) BETWEEN 1 AND 40
  )
);


COMMENT ON TABLE public.notification_events IS 'Point-in-time push events. No tokens, emails, or moderation notes are stored in payload.';


CREATE INDEX if NOT EXISTS notification_events_due_idx ON public.notification_events (status, next_attempt_at);


CREATE INDEX if NOT EXISTS notification_events_user_recent_idx ON public.notification_events (user_id, created_at DESC);


CREATE TRIGGER notification_events_set_updated_at
BEFORE UPDATE ON public.notification_events FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- Scheduler functions (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_events (p_now timestamptz, p_limit integer DEFAULT 50) returns TABLE (
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


COMMENT ON function public.claim_notification_events (timestamptz, integer) IS 'Atomically claims due event rows with FOR UPDATE SKIP LOCKED. service_role only.';


CREATE OR REPLACE FUNCTION public.complete_notification_event (
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


COMMENT ON function public.complete_notification_event (uuid, text, text, timestamptz) IS 'Finishes a claimed event. service_role only.';


REVOKE ALL ON function public.claim_notification_events (timestamptz, integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.claim_notification_events (timestamptz, integer) TO service_role;


REVOKE ALL ON function public.complete_notification_event (uuid, text, text, timestamptz)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.complete_notification_event (uuid, text, text, timestamptz) TO service_role;
