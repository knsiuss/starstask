-- Row Level Security for discussion sessions.
--
-- Reads are scoped by `can_view_session`: class members and managers see their
-- class sessions, everyone sees public ones, and a participant keeps access to a
-- session they already registered for. Writes happen only inside the SECURITY
-- DEFINER functions, so the tables get no INSERT/UPDATE/DELETE grants at all.
ALTER TABLE public.discussion_sessions enable ROW level security;


ALTER TABLE public.discussion_session_rsvps enable ROW level security;


ALTER TABLE public.discussion_session_reminders enable ROW level security;


-- ---------------------------------------------------------------------------
-- discussion_sessions
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.discussion_sessions
FROM
  anon,
  authenticated;


-- Anonymous visitors get the public listing columns only: the join link and the
-- agenda stay behind the sign-in boundary even for a public session.
GRANT
SELECT
  (
    id,
    class_id,
    assignment_id,
    organizer_id,
    title,
    description,
    session_type,
    location,
    starts_at,
    ends_at,
    time_zone,
    capacity,
    registration_deadline,
    visibility,
    status,
    cancelled_at,
    completed_at,
    created_at,
    updated_at
  ) ON public.discussion_sessions TO anon;


GRANT
SELECT
  (
    id,
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
    status,
    cancelled_at,
    completed_at,
    created_at,
    updated_at
  ) ON public.discussion_sessions TO authenticated;


DROP POLICY if EXISTS discussion_sessions_read ON public.discussion_sessions;


CREATE POLICY discussion_sessions_read ON public.discussion_sessions FOR
SELECT
  TO anon,
  authenticated USING (public.can_view_session (id));


-- ---------------------------------------------------------------------------
-- discussion_session_rsvps
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.discussion_session_rsvps
FROM
  anon,
  authenticated;


GRANT
SELECT
  (id, session_id, user_id, status, created_at, updated_at) ON public.discussion_session_rsvps TO authenticated;


-- A member sees their own RSVP. The participant list (who is going) is only
-- available to the class managers, so attendance counts are the public surface
-- for everyone else.
DROP POLICY if EXISTS discussion_session_rsvps_read ON public.discussion_session_rsvps;


CREATE POLICY discussion_session_rsvps_read ON public.discussion_session_rsvps FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_manage_class (public.session_class_id (session_id))
  );


-- ---------------------------------------------------------------------------
-- discussion_session_reminders: scheduler-only ledger
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.discussion_session_reminders
FROM
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- notification_preferences: the two session reminder windows are user-writable
-- ---------------------------------------------------------------------------
GRANT insert (session_reminder_24h, session_reminder_3h) ON public.notification_preferences TO authenticated;


GRANT
UPDATE (session_reminder_24h, session_reminder_3h) ON public.notification_preferences TO authenticated;
