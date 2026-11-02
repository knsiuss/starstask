-- In-app notification inbox.
--
-- `notification_events` used to be a push-only queue: enqueue skipped anyone
-- without an active push device. The inbox makes the row itself the durable
-- record, so every event is stored and push becomes only a delivery detail.
ALTER TABLE public.notification_events
ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_events_user_unread_idx ON public.notification_events (user_id, created_at DESC)
WHERE
  read_at IS NULL;

-- Clients only need the read marker. Every other column keeps its existing
-- grant, so the inbox cannot be used to rewrite event content.
GRANT
SELECT
  (read_at) ON public.notification_events TO authenticated;

-- Stores every event. Users who disabled push still get an inbox row; the
-- scheduler marks undeliverable rows skipped without deleting them.
CREATE OR REPLACE FUNCTION public.enqueue_notification_event (
  p_user_id uuid,
  p_kind text,
  p_dedupe_key text,
  p_payload jsonb
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notification_events (user_id, kind, dedupe_key, payload)
  values (p_user_id, p_kind, p_dedupe_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (dedupe_key) do nothing;
end;
$$;

COMMENT ON FUNCTION public.enqueue_notification_event (uuid, text, text, jsonb) IS 'Queues an event for the in-app inbox and, when the user has push enabled, for delivery. Internal only.';

-- Marks the caller's own notifications read. A NULL array marks every unread
-- row; an array marks only the listed ids. Rows belonging to another user are
-- ignored by the WHERE clause and by row-level security.
CREATE OR REPLACE FUNCTION public.mark_notification_events_read (p_ids UUID[] DEFAULT NULL) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (select auth.uid ());
  v_count integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.notification_events
  set
    read_at = now()
  where
    user_id = v_user
    and read_at is null
    and (
      p_ids is null
      or id = any (p_ids)
    );

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

COMMENT ON FUNCTION public.mark_notification_events_read (UUID[]) IS 'Marks the caller''s unread notifications read. Authenticated only.';

REVOKE ALL ON function public.mark_notification_events_read (UUID[])
FROM
  public,
  anon,
  authenticated;

GRANT
EXECUTE ON function public.mark_notification_events_read (UUID[]) TO authenticated;
