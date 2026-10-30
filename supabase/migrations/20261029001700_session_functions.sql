-- Discussion session workflow functions.
--
-- Every privileged state change lives here so it is atomic and cannot be forged
-- by a browser client:
--   authenticated    -> rsvp_discussion_session, cancel_session_rsvp
--   class manager    -> create/update sessions, change status
--   platform admin   -> the same, for any class
--   service_role     -> session reminder audience, claim, complete
--
-- Predicates are SECURITY DEFINER because RLS policies call them; a policy that
-- queried the same table directly would recurse.
CREATE OR REPLACE FUNCTION public.session_class_id (p_session_id uuid) returns uuid language sql stable security definer
SET
  search_path = '' AS $$
select
  s.class_id
from
  public.discussion_sessions s
where
  s.id = p_session_id;
$$;


COMMENT ON function public.session_class_id (uuid) IS 'Class of a session, resolved without RLS so policies can use it.';


CREATE OR REPLACE FUNCTION public.can_organize_class_sessions (p_class_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  public.is_platform_admin ()
  or public.is_class_admin (p_class_id);
$$;


COMMENT ON function public.can_organize_class_sessions (uuid) IS 'Platform admins and admins of that class may schedule sessions. Students never can.';


-- A session is readable by its class members and managers, by anyone the
-- session is public to, and by a participant who already RSVP'd (so a later
-- visibility change cannot hide a session from someone who registered).
CREATE OR REPLACE FUNCTION public.can_view_session (p_session_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.discussion_sessions s
    where
      s.id = p_session_id
      and (
        s.visibility = 'public'
        or public.is_platform_admin ()
        or public.is_class_member (s.class_id)
        or public.is_class_admin (s.class_id)
        or exists (
          select
            1
          from
            public.discussion_session_rsvps r
          where
            r.session_id = s.id
            and r.user_id = (
              select
                auth.uid ()
            )
        )
      )
  );
$$;


-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_session_notification (
  p_user_id uuid,
  p_kind text,
  p_dedupe_key text,
  p_title text,
  p_body text,
  p_url text
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin -- enqueue_notification_event already filters to opted-in users with a
-- live device, so a session event never lands in a queue nobody drains.
perform public.enqueue_notification_event (
  p_user_id,
  p_kind,
  p_dedupe_key,
  jsonb_build_object(
    'title',
    left(p_title, 120),
    'body',
    left(p_body, 240),
    'url',
    p_url
  )
);
end;
$$;


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
  v_user_id uuid;
  v_count integer := 0;
begin
  for v_user_id in
  select distinct
    r.user_id
  from
    public.discussion_session_rsvps r
  where
    r.session_id = p_session_id
    and r.status in ('going', 'maybe')
  loop
    perform public.queue_session_notification (
      v_user_id,
      p_kind,
      p_dedupe_prefix || ':' || v_user_id::text,
      p_title,
      p_body,
      p_url
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- A rescheduled or cancelled session must not keep delivering reminders for the
-- old instant, and its calendar mapping has to be reconciled by the next sync.
CREATE OR REPLACE FUNCTION public.settle_session_side_effects (p_session_id uuid, p_starts_at timestamptz) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin
update public.discussion_session_reminders r
set
  status = 'skipped',
  last_error_category = 'schedule_changed',
  updated_at = now()
where
  r.session_id = p_session_id
  and r.status in ('pending', 'processing')
  and r.starts_at is distinct
from
  p_starts_at;

update public.google_calendar_event_mappings m
set
  status = 'out_of_sync',
  next_attempt_at = now(),
  updated_at = now()
where
  m.session_id = p_session_id
  and m.status in ('pending', 'synced', 'failed');
end;
$$;


-- ---------------------------------------------------------------------------
-- Create / update / status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_discussion_session (
  p_class_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_time_zone text,
  p_session_type text DEFAULT 'online',
  p_meeting_url text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_agenda text DEFAULT NULL,
  p_capacity integer DEFAULT NULL,
  p_registration_deadline timestamptz DEFAULT NULL,
  p_visibility text DEFAULT 'class_members',
  p_assignment_id uuid DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_class_status text;
  v_session_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.can_organize_class_sessions (p_class_id) then
    raise exception 'not allowed to schedule sessions for this class' using errcode = '42501';
  end if;

  select
    c.status into v_class_status
  from
    public.classes c
  where
    c.id = p_class_id;

  if v_class_status is null then
    raise exception 'class not found' using errcode = 'P0002';
  end if;

  if v_class_status <> 'active' then
    raise exception 'archived classes cannot schedule sessions' using errcode = '22023';
  end if;

  if p_ends_at <= now() then
    raise exception 'a session must end in the future' using errcode = '22023';
  end if;

  if p_assignment_id is not null and not exists (
    select
      1
    from
      public.assignments a
    where
      a.id = p_assignment_id
      and a.class_id = p_class_id
  ) then
    raise exception 'the assignment does not belong to this class' using errcode = '23503';
  end if;

  insert into public.discussion_sessions (
    class_id,
    assignment_id,
    organizer_id,
    title,
    description,
    agenda,
    session_type,
    meeting_url,
    location,
    starts_at,
    ends_at,
    time_zone,
    capacity,
    registration_deadline,
    visibility,
    status
  )
values (
  p_class_id,
  p_assignment_id,
  v_actor,
  btrim(p_title),
  btrim(p_description),
  nullif(btrim(coalesce(p_agenda, '')), ''),
  p_session_type,
  nullif(btrim(coalesce(p_meeting_url, '')), ''),
  nullif(btrim(coalesce(p_location, '')), ''),
  p_starts_at,
  p_ends_at,
  p_time_zone,
  p_capacity,
  p_registration_deadline,
  p_visibility,
  'scheduled'
)
returning
  id into v_session_id;

perform public.record_audit (
  'session_created',
  'discussion_session',
  v_session_id,
  p_class_id,
  jsonb_build_object(
    'starts_at',
    p_starts_at,
    'session_type',
    p_session_type,
    'visibility',
    p_visibility
  )
);

return v_session_id;
end;
$$;


COMMENT ON function public.create_discussion_session IS 'Creates a scheduled session for a class the caller administers.';


CREATE OR REPLACE FUNCTION public.update_discussion_session (
  p_session_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_time_zone text,
  p_session_type text DEFAULT 'online',
  p_meeting_url text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_agenda text DEFAULT NULL,
  p_capacity integer DEFAULT NULL,
  p_registration_deadline timestamptz DEFAULT NULL,
  p_visibility text DEFAULT 'class_members',
  p_assignment_id uuid DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
  v_status text;
  v_old_starts_at timestamptz;
  v_old_title text;
  v_old_meeting_url text;
  v_old_location text;
  v_schedule_changed boolean;
  v_going integer;
  v_dedupe text;
begin
  select
    s.class_id,
    s.status,
    s.starts_at,
    s.title,
    s.meeting_url,
    s.location into v_class_id,
    v_status,
    v_old_starts_at,
    v_old_title,
    v_old_meeting_url,
    v_old_location
  from
    public.discussion_sessions s
  where
    s.id = p_session_id for
  update;

  if v_class_id is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'not allowed to change this session' using errcode = '42501';
  end if;

  if v_status <> 'scheduled' then
    raise exception 'only scheduled sessions can be edited' using errcode = '22023';
  end if;

  if p_assignment_id is not null and not exists (
    select
      1
    from
      public.assignments a
    where
      a.id = p_assignment_id
      and a.class_id = v_class_id
  ) then
    raise exception 'the assignment does not belong to this class' using errcode = '23503';
  end if;

  v_schedule_changed := v_old_starts_at is distinct
from
  p_starts_at
  or v_old_title is distinct
from
  btrim(p_title)
  or v_old_meeting_url is distinct
from
  nullif(btrim(coalesce(p_meeting_url, '')), '')
  or v_old_location is distinct
from
  nullif(btrim(coalesce(p_location, '')), '');

update public.discussion_sessions
set
  title = btrim(p_title),
  description = btrim(p_description),
  agenda = nullif(btrim(coalesce(p_agenda, '')), ''),
  session_type = p_session_type,
  meeting_url = nullif(btrim(coalesce(p_meeting_url, '')), ''),
  location = nullif(btrim(coalesce(p_location, '')), ''),
  starts_at = p_starts_at,
  ends_at = p_ends_at,
  time_zone = p_time_zone,
  capacity = p_capacity,
  registration_deadline = p_registration_deadline,
  visibility = p_visibility,
  assignment_id = p_assignment_id
where
  id = p_session_id;

-- Shrinking the capacity below the current head count would leave the session
-- over capacity; refuse instead of silently evicting participants.
if p_capacity is not null then
  select
    count(*) into v_going
  from
    public.discussion_session_rsvps r
  where
    r.session_id = p_session_id
    and r.status = 'going';

  if v_going > p_capacity then
    raise exception 'capacity is below the number of participants already going' using errcode = 'SS001';
  end if;
end if;

perform public.record_audit (
  'session_updated',
  'discussion_session',
  p_session_id,
  v_class_id,
  jsonb_build_object(
    'starts_at',
    p_starts_at,
    'schedule_changed',
    v_schedule_changed
  )
);

if v_schedule_changed then
  perform public.settle_session_side_effects (p_session_id, p_starts_at);

  v_dedupe := 'session_updated:' || p_session_id::text || ':' || extract(
    epoch
    from
      clock_timestamp()
  )::bigint::text;

  perform public.notify_session_participants (
    p_session_id,
    'session_updated',
    v_dedupe,
    'Session details changed',
    format(
      '%s has new details. Open StarsTask to check the updated time.',
      left(btrim(p_title), 80)
    ),
    '/sessions/' || p_session_id::text
  );
end if;

return true;
end;
$$;


COMMENT ON function public.update_discussion_session IS 'Edits a scheduled session and notifies participants when the schedule or place changed.';


CREATE OR REPLACE FUNCTION public.set_discussion_session_status (p_session_id uuid, p_status text) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
  v_current text;
  v_starts_at timestamptz;
  v_title text;
  v_dedupe text;
begin
  if p_status not in ('scheduled', 'cancelled', 'completed') then
    raise exception 'invalid session status' using errcode = '22023';
  end if;

  select
    s.class_id,
    s.status,
    s.starts_at,
    s.title into v_class_id,
    v_current,
    v_starts_at,
    v_title
  from
    public.discussion_sessions s
  where
    s.id = p_session_id for
  update;

  if v_class_id is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if not public.can_organize_class_sessions (v_class_id) then
    raise exception 'not allowed to change this session' using errcode = '42501';
  end if;

  if v_current = p_status then
    return true;
  end if;

  if v_current = 'completed' and p_status <> 'scheduled' then
    raise exception 'a completed session can only be reopened' using errcode = '22023';
  end if;

  update public.discussion_sessions
  set
    status = p_status,
    cancelled_at = case
      when p_status = 'cancelled' then now()
      else null
    end,
    completed_at = case
      when p_status = 'completed' then now()
      else null
    end
  where
    id = p_session_id;

  perform public.record_audit (
    case
      when p_status = 'cancelled' then 'session_cancelled'
      when p_status = 'completed' then 'session_completed'
      else 'session_reopened'
    end,
    'discussion_session',
    p_session_id,
    v_class_id,
    jsonb_build_object('from', v_current, 'to', p_status)
  );

  -- Cancelling or completing must stop pending reminders and reconcile any
  -- calendar event that was already created.
  if p_status in ('cancelled', 'completed') then
    update public.discussion_session_reminders r
    set
      status = 'skipped',
      last_error_category = case
        when p_status = 'cancelled' then 'session_cancelled'
        else 'session_completed'
      end,
      updated_at = now()
    where
      r.session_id = p_session_id
      and r.status in ('pending', 'processing');

    update public.google_calendar_event_mappings m
    set
      status = 'out_of_sync',
      next_attempt_at = now(),
      updated_at = now()
    where
      m.session_id = p_session_id
      and m.status in ('pending', 'synced', 'failed');
  end if;

  if p_status = 'cancelled' then
    v_dedupe := 'session_cancelled:' || p_session_id::text || ':' || extract(
      epoch
      from
        v_starts_at
    )::bigint::text;

    perform public.notify_session_participants (
      p_session_id,
      'session_cancelled',
      v_dedupe,
      'Session cancelled',
      format('%s has been cancelled.', left(v_title, 80)),
      '/sessions/' || p_session_id::text
    );
  elsif p_status = 'scheduled' and v_current = 'cancelled' then
    v_dedupe := 'session_updated:' || p_session_id::text || ':' || extract(
      epoch
      from
        clock_timestamp()
    )::bigint::text;

    perform public.notify_session_participants (
      p_session_id,
      'session_updated',
      v_dedupe,
      'Session back on',
      format('%s is scheduled again.', left(v_title, 80)),
      '/sessions/' || p_session_id::text
    );
  end if;

  return true;
end;
$$;


COMMENT ON function public.set_discussion_session_status IS 'Cancel, complete, or reopen a session. Cancelling skips reminders and reschedules calendar sync.';


-- ---------------------------------------------------------------------------
-- RSVP
-- ---------------------------------------------------------------------------
-- The session row is locked for the duration of the check, so two concurrent
-- "going" requests for the last seat cannot both pass the capacity test.
CREATE OR REPLACE FUNCTION public.rsvp_discussion_session (p_session_id uuid, p_status text) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_session public.discussion_sessions;
  v_existing text;
  v_going integer;
  v_maybe integer;
  v_not_going integer;
  v_organizer uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_status not in ('going', 'maybe', 'not_going') then
    raise exception 'invalid rsvp status' using errcode = '22023';
  end if;

  select
    s.* into v_session
  from
    public.discussion_sessions s
  where
    s.id = p_session_id for
  update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if not public.can_view_session (p_session_id) then
    raise exception 'not allowed to join this session' using errcode = '42501';
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'this session is not open for registration' using errcode = 'SS003';
  end if;

  if v_session.starts_at <= now()
  or (
    v_session.registration_deadline is not null
    and v_session.registration_deadline <= now()
  ) then
    raise exception 'registration for this session is closed' using errcode = 'SS002';
  end if;

  select
    r.status into v_existing
  from
    public.discussion_session_rsvps r
  where
    r.session_id = p_session_id
    and r.user_id = v_actor;

  if p_status = 'going'
  and v_session.capacity is not null
  and coalesce(v_existing, '') <> 'going' then
    select
      count(*) into v_going
    from
      public.discussion_session_rsvps r
    where
      r.session_id = p_session_id
      and r.status = 'going';

    if v_going >= v_session.capacity then
      raise exception 'this session is full' using errcode = 'SS001';
    end if;
  end if;

  insert into public.discussion_session_rsvps (session_id, user_id, status)
values (p_session_id, v_actor, p_status) on conflict (session_id, user_id) do
update
set
  status = excluded.status,
  updated_at = now();

perform public.record_audit (
  'session_rsvp',
  'discussion_session',
  p_session_id,
  v_session.class_id,
  jsonb_build_object('status', p_status)
);

-- The organizer only needs to know that somebody committed, not every flip
-- between maybe and not going.
if p_status = 'going' and v_existing is distinct
from
  'going' then
  v_organizer := v_session.organizer_id;

  if v_organizer is distinct
from
  v_actor then
    perform public.queue_session_notification (
      v_organizer,
      'session_rsvp',
      'session_rsvp:' || p_session_id::text || ':' || v_actor::text || ':' || extract(
        epoch
        from
          clock_timestamp()
      )::bigint::text,
      'New participant',
      format(
        'Someone is going to %s.',
        left(v_session.title, 80)
      ),
      '/sessions/' || p_session_id::text
    );
  end if;
end if;

select
  count(*) filter (
    where
      r.status = 'going'
  ),
  count(*) filter (
    where
      r.status = 'maybe'
  ),
  count(*) filter (
    where
      r.status = 'not_going'
  ) into v_going,
  v_maybe,
  v_not_going
from
  public.discussion_session_rsvps r
where
  r.session_id = p_session_id;

return jsonb_build_object(
  'status',
  p_status,
  'going_count',
  v_going,
  'maybe_count',
  v_maybe,
  'not_going_count',
  v_not_going,
  'capacity',
  v_session.capacity
);
end;
$$;


COMMENT ON function public.rsvp_discussion_session IS 'Upserts the caller RSVP, enforcing the registration window and capacity under a row lock.';


CREATE OR REPLACE FUNCTION public.cancel_session_rsvp (p_session_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.discussion_session_rsvps r
where
  r.session_id = p_session_id
  and r.user_id = v_actor;

  return found;
end;
$$;


COMMENT ON function public.cancel_session_rsvp (uuid) IS 'Removes the caller RSVP. Other rows are unreachable because user_id comes from auth.uid().';


-- Attendance is readable by anyone who may see the session, but individual
-- participants stay private to class managers.
CREATE OR REPLACE FUNCTION public.session_attendance (p_session_id uuid) returns TABLE (
  going_count integer,
  maybe_count integer,
  not_going_count integer,
  capacity integer,
  viewer_status text
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$ begin if not public.can_view_session (p_session_id) then raise exception 'not allowed to read this session' using errcode = '42501';
end if;

-- A session with no RSVP yet still needs one row, otherwise the caller cannot
-- tell "no participants" from "not allowed to read".
return query
select
  (
    select
      count(*)::integer
    from
      public.discussion_session_rsvps r
    where
      r.session_id = p_session_id
      and r.status = 'going'
  ),
  (
    select
      count(*)::integer
    from
      public.discussion_session_rsvps r
    where
      r.session_id = p_session_id
      and r.status = 'maybe'
  ),
  (
    select
      count(*)::integer
    from
      public.discussion_session_rsvps r
    where
      r.session_id = p_session_id
      and r.status = 'not_going'
  ),
  (
    select
      s.capacity
    from
      public.discussion_sessions s
    where
      s.id = p_session_id
  ),
  (
    select
      r.status
    from
      public.discussion_session_rsvps r
    where
      r.session_id = p_session_id
      and r.user_id = (
        select
          auth.uid ()
      )
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Listing
-- ---------------------------------------------------------------------------
-- One round trip returns the session, its class, its organizer, and the
-- attendance counts. Visibility is re-checked per row with can_view_session, so
-- a caller cannot widen the result by passing a different class id.
CREATE OR REPLACE FUNCTION public.list_discussion_sessions (
  p_class_id uuid DEFAULT NULL,
  p_status text DEFAULT 'upcoming',
  p_type text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
) returns TABLE (
  id uuid,
  class_id uuid,
  class_slug text,
  class_name text,
  assignment_id uuid,
  organizer_id uuid,
  organizer_display_name text,
  organizer_avatar_url text,
  title text,
  description text,
  agenda text,
  session_type text,
  meeting_url text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text,
  capacity integer,
  registration_deadline timestamptz,
  visibility text,
  status text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  going_count integer,
  maybe_count integer,
  viewer_status text,
  total_count bigint
) language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  s.id,
  s.class_id,
  c.slug,
  c.name,
  s.assignment_id,
  s.organizer_id,
  coalesce(pr.display_name, 'StarsTask member'),
  pr.avatar_url,
  s.title,
  s.description,
  -- Anonymous visitors may read a public session, but the join link and agenda
  -- stay behind the sign-in boundary.
  case
    when (select auth.uid ()) is null then null
    else s.agenda
  end,
  s.session_type,
  case
    when (select auth.uid ()) is null then null
    else s.meeting_url
  end,
  s.location,
  s.starts_at,
  s.ends_at,
  s.time_zone,
  s.capacity,
  s.registration_deadline,
  s.visibility,
  s.status,
  s.cancelled_at,
  s.completed_at,
  s.created_at,
  s.updated_at,
  coalesce(att.going_count, 0),
  coalesce(att.maybe_count, 0),
  own.status,
  count(*) over ()
from
  public.discussion_sessions s
  join public.classes c on c.id = s.class_id
  left join public.profiles pr on pr.id = s.organizer_id
  left join (
    select
      r.session_id,
      count(*) filter (
        where
          r.status = 'going'
      )::integer as going_count,
      count(*) filter (
        where
          r.status = 'maybe'
      )::integer as maybe_count
    from
      public.discussion_session_rsvps r
    group by
      r.session_id
  ) att on att.session_id = s.id
  left join public.discussion_session_rsvps own on own.session_id = s.id
  and own.user_id = (
    select
      auth.uid ()
  )
where
  public.can_view_session (s.id)
  and (p_class_id is null or s.class_id = p_class_id)
  and (p_type is null or s.session_type = p_type)
  and (
    p_from is null
    or s.ends_at >= p_from
  )
  and (
    p_to is null
    or s.starts_at <= p_to
  )
  and case coalesce(p_status, 'upcoming')
    when 'upcoming' then s.status = 'scheduled'
    and s.ends_at > now()
    when 'all' then true
    else s.status = p_status
  end
order by
  case
    when coalesce(p_status, 'upcoming') = 'upcoming' then s.starts_at
  end asc nulls last,
  case
    when coalesce(p_status, 'upcoming') <> 'upcoming' then s.starts_at
  end desc nulls last
limit least(greatest(coalesce(p_limit, 24), 1), 100)
offset greatest(coalesce(p_offset, 0), 0);
$$;


COMMENT ON function public.list_discussion_sessions IS 'Visibility-filtered session list with class, organizer, and attendance counts.';


-- ---------------------------------------------------------------------------
-- Reminder scheduler (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_session_reminder_audience (p_session_ids UUID[]) returns TABLE (
  session_id uuid,
  user_id uuid,
  pref_timezone text,
  reminder_24h boolean,
  reminder_3h boolean
) language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  s.id,
  r.user_id,
  p.timezone,
  p.session_reminder_24h,
  p.session_reminder_3h
from
  public.discussion_sessions s
  join public.discussion_session_rsvps r on r.session_id = s.id
  and r.status = 'going'
  join public.notification_preferences p on p.user_id = r.user_id
  and p.push_enabled
where
  s.id = any (p_session_ids)
  and s.status = 'scheduled'
  and exists (
    select
      1
    from
      public.push_subscriptions ps
    where
      ps.user_id = r.user_id
      and ps.disabled_at is null
  );
$$;


COMMENT ON function public.list_session_reminder_audience (UUID[]) IS 'Going participants, opted in, with at least one active device. service_role only.';


CREATE OR REPLACE FUNCTION public.claim_session_reminders (p_now timestamptz, p_limit integer DEFAULT 50) returns TABLE (
  id uuid,
  user_id uuid,
  session_id uuid,
  reminder_type text,
  starts_at timestamptz,
  attempt_count integer,
  session_title text,
  session_status text,
  session_time_zone text,
  session_ends_at timestamptz,
  current_starts_at timestamptz,
  class_name text,
  push_enabled boolean,
  reminder_24h boolean,
  reminder_3h boolean,
  pref_timezone text
) language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin -- Rows for users who turned push off, lost every device, or whose session is
-- no longer scheduled are useless by the time they would be delivered.
update public.discussion_session_reminders r
set
  status = 'skipped',
  last_error_category = coalesce(r.last_error_category, 'audience_unavailable'),
  updated_at = v_now
where
  r.status = 'pending'
  and (
    not exists (
      select
        1
      from
        public.notification_preferences p
      where
        p.user_id = r.user_id
        and p.push_enabled
    )
    or not exists (
      select
        1
      from
        public.push_subscriptions s
      where
        s.user_id = r.user_id
        and s.disabled_at is null
    )
    or exists (
      select
        1
      from
        public.discussion_sessions s
      where
        s.id = r.session_id
        and s.status <> 'scheduled'
    )
  );

-- A worker that crashed mid-send leaves rows in 'processing'.
update public.discussion_session_reminders r
set
  status = 'pending',
  next_attempt_at = v_now,
  updated_at = v_now
where
  r.status = 'processing'
  and r.updated_at < v_now - interval '10 minutes';

return query with claimable as (
  select
    r.id
  from
    public.discussion_session_reminders r
  where
    r.status = 'pending'
    and r.next_attempt_at <= v_now
  order by
    r.next_attempt_at asc,
    r.created_at asc
  limit v_limit for
  update skip locked
),
claimed as (
  update public.discussion_session_reminders r
  set
    status = 'processing',
    attempt_count = r.attempt_count + 1,
    updated_at = v_now
  from
    claimable c
  where
    r.id = c.id
  returning
    r.*
)
select
  c.id,
  c.user_id,
  c.session_id,
  c.reminder_type,
  c.starts_at,
  c.attempt_count,
  s.title,
  s.status,
  s.time_zone,
  s.ends_at,
  s.starts_at,
  cl.name,
  p.push_enabled,
  p.session_reminder_24h,
  p.session_reminder_3h,
  p.timezone
from
  claimed c
  join public.discussion_sessions s on s.id = c.session_id
  join public.classes cl on cl.id = s.class_id
  left join public.notification_preferences p on p.user_id = c.user_id;
end;
$$;


COMMENT ON function public.claim_session_reminders (timestamptz, integer) IS 'Atomically claims due session reminders with FOR UPDATE SKIP LOCKED. service_role only.';


CREATE OR REPLACE FUNCTION public.complete_session_reminder (
  p_id uuid,
  p_status text,
  p_error_category text DEFAULT NULL,
  p_next_attempt_at timestamptz DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$ begin if p_status not in ('sent', 'failed', 'skipped', 'pending') then raise exception 'invalid reminder status' using errcode = '22023';
end if;

update public.discussion_session_reminders r
set
  status = p_status,
  last_error_category = case
    when p_status = 'sent' then null
    else nullif(btrim(coalesce(p_error_category, '')), '')
  end,
  delivered_at = case
    when p_status = 'sent' then now()
    else r.delivered_at
  end,
  next_attempt_at = coalesce(p_next_attempt_at, r.next_attempt_at),
  updated_at = now()
where
  r.id = p_id
  and r.status = 'processing';

return found;
end;
$$;


COMMENT ON function public.complete_session_reminder (uuid, text, text, timestamptz) IS 'Finishes a claimed session reminder. service_role only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- `session_class_id` and `can_view_session` are called from RLS policies, so the
-- querying role needs EXECUTE on them. Anonymous visitors only ever reach the
-- public-session branch, and every other predicate returns false for them.
REVOKE ALL ON function public.session_class_id (uuid)
FROM
  public;


REVOKE ALL ON function public.session_class_id (uuid)
FROM
  anon;


GRANT
EXECUTE ON function public.session_class_id (uuid) TO authenticated;


GRANT
EXECUTE ON function public.session_class_id (uuid) TO service_role;


REVOKE ALL ON function public.can_organize_class_sessions (uuid)
FROM
  public;


REVOKE ALL ON function public.can_organize_class_sessions (uuid)
FROM
  anon;


REVOKE ALL ON function public.queue_session_notification (uuid, text, text, text, text, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.notify_session_participants (uuid, text, text, text, text, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.settle_session_side_effects (uuid, timestamptz)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.create_discussion_session (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  text,
  uuid
)
FROM
  public,
  anon;


REVOKE ALL ON function public.update_discussion_session (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  text,
  uuid
)
FROM
  public,
  anon;


REVOKE ALL ON function public.set_discussion_session_status (uuid, text)
FROM
  public,
  anon;


REVOKE ALL ON function public.rsvp_discussion_session (uuid, text)
FROM
  public,
  anon;


REVOKE ALL ON function public.cancel_session_rsvp (uuid)
FROM
  public,
  anon;


REVOKE ALL ON function public.session_attendance (uuid)
FROM
  public,
  anon;


REVOKE ALL ON function public.list_discussion_sessions (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
)
FROM
  public;


REVOKE ALL ON function public.list_session_reminder_audience (UUID[])
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.list_session_reminder_audience (UUID[]) TO service_role;


REVOKE ALL ON function public.claim_session_reminders (timestamptz, integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.claim_session_reminders (timestamptz, integer) TO service_role;


REVOKE ALL ON function public.complete_session_reminder (uuid, text, text, timestamptz)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.complete_session_reminder (uuid, text, text, timestamptz) TO service_role;
