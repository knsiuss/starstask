-- Academic discussion sessions.
--
-- Tables added here:
--   discussion_sessions              a scheduled online or in-person session
--   discussion_session_rsvps         one RSVP per user per session
--   discussion_session_reminders     durable reminder ledger (24h / 3h)
--
-- Two existing tables gain columns: `notification_preferences` gets the session
-- reminder toggles, and `notification_events` accepts the new session kinds.
--
-- Times are stored as UTC instants (`timestamptz`); `time_zone` keeps the IANA
-- zone the organizer intended, which is what the UI and the Google Calendar
-- link display.
CREATE EXTENSION if NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------------
-- discussion_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments (id) ON DELETE SET NULL,
  organizer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  agenda text,
  session_type text NOT NULL DEFAULT 'online',
  meeting_url text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  time_zone text NOT NULL DEFAULT 'Asia/Jakarta',
  capacity integer,
  registration_deadline timestamptz,
  visibility text NOT NULL DEFAULT 'class_members',
  status text NOT NULL DEFAULT 'scheduled',
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discussion_sessions_title_length CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  CONSTRAINT discussion_sessions_description_length CHECK (char_length(btrim(description)) BETWEEN 10 AND 5000),
  CONSTRAINT discussion_sessions_agenda_length CHECK (
    agenda IS NULL
    OR char_length(btrim(agenda)) <= 5000
  ),
  CONSTRAINT discussion_sessions_type_allowed CHECK (session_type IN ('online', 'in_person')),
  -- An online session needs a join link; an in-person one needs a place.
  CONSTRAINT discussion_sessions_online_url CHECK (
    session_type <> 'online'
    OR (
      meeting_url IS NOT NULL
      AND meeting_url LIKE 'https://%'
      AND char_length(meeting_url) BETWEEN 10 AND 2048
    )
  ),
  CONSTRAINT discussion_sessions_in_person_location CHECK (
    session_type <> 'in_person'
    OR (
      location IS NOT NULL
      AND char_length(btrim(location)) BETWEEN 3 AND 200
    )
  ),
  CONSTRAINT discussion_sessions_location_length CHECK (
    location IS NULL
    OR char_length(btrim(location)) BETWEEN 1 AND 200
  ),
  CONSTRAINT discussion_sessions_meeting_url_https CHECK (
    meeting_url IS NULL
    OR (
      meeting_url LIKE 'https://%'
      AND char_length(meeting_url) BETWEEN 10 AND 2048
    )
  ),
  CONSTRAINT discussion_sessions_window CHECK (
    ends_at > starts_at
    AND ends_at <= starts_at + interval '24 hours'
  ),
  CONSTRAINT discussion_sessions_time_zone_length CHECK (char_length(btrim(time_zone)) BETWEEN 1 AND 64),
  CONSTRAINT discussion_sessions_capacity_range CHECK (
    capacity IS NULL
    OR capacity BETWEEN 1 AND 1000
  ),
  -- A registration deadline after the session starts would never close it.
  CONSTRAINT discussion_sessions_registration_window CHECK (
    registration_deadline IS NULL
    OR registration_deadline <= starts_at
  ),
  CONSTRAINT discussion_sessions_visibility_allowed CHECK (visibility IN ('class_members', 'public')),
  CONSTRAINT discussion_sessions_status_allowed CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  -- Status and its timestamp cannot drift apart, even through a direct write.
  CONSTRAINT discussion_sessions_status_consistency CHECK (
    (
      status = 'scheduled'
      AND cancelled_at IS NULL
      AND completed_at IS NULL
    )
    OR (
      status = 'cancelled'
      AND cancelled_at IS NOT NULL
      AND completed_at IS NULL
    )
    OR (
      status = 'completed'
      AND cancelled_at IS NULL
      AND completed_at IS NOT NULL
    )
  )
);


COMMENT ON TABLE public.discussion_sessions IS 'Scheduled class discussions. Created and changed only through the SECURITY DEFINER functions in 20261029001700_session_functions.sql.';


COMMENT ON COLUMN public.discussion_sessions.time_zone IS 'IANA zone the organizer intended, for display and the Google Calendar link. Instants stay in UTC.';


COMMENT ON COLUMN public.discussion_sessions.visibility IS 'class_members = members and managers of the class; public = any visitor may read it.';


CREATE INDEX if NOT EXISTS discussion_sessions_class_idx ON public.discussion_sessions (class_id, starts_at);


CREATE INDEX if NOT EXISTS discussion_sessions_upcoming_idx ON public.discussion_sessions (starts_at)
WHERE
  status = 'scheduled';


CREATE INDEX if NOT EXISTS discussion_sessions_public_upcoming_idx ON public.discussion_sessions (starts_at)
WHERE
  status = 'scheduled'
  AND visibility = 'public';


CREATE INDEX if NOT EXISTS discussion_sessions_organizer_idx ON public.discussion_sessions (organizer_id, starts_at DESC);


CREATE INDEX if NOT EXISTS discussion_sessions_assignment_idx ON public.discussion_sessions (assignment_id)
WHERE
  assignment_id IS NOT NULL;


CREATE TRIGGER discussion_sessions_set_updated_at
BEFORE UPDATE ON public.discussion_sessions FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- discussion_session_rsvps
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_session_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.discussion_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One row per person per session is the concurrency guard: a double submit
  -- updates the existing row instead of counting twice against the capacity.
  CONSTRAINT discussion_session_rsvps_unique UNIQUE (session_id, user_id),
  CONSTRAINT discussion_session_rsvps_status_allowed CHECK (status IN ('going', 'maybe', 'not_going'))
);


COMMENT ON TABLE public.discussion_session_rsvps IS 'Participant registrations. Written only through rsvp_discussion_session / cancel_session_rsvp.';


CREATE INDEX if NOT EXISTS discussion_session_rsvps_session_idx ON public.discussion_session_rsvps (session_id, status);


CREATE INDEX if NOT EXISTS discussion_session_rsvps_user_idx ON public.discussion_session_rsvps (user_id, updated_at DESC);


CREATE TRIGGER discussion_session_rsvps_set_updated_at
BEFORE UPDATE ON public.discussion_session_rsvps FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- discussion_session_reminders: durable reminder ledger
-- ---------------------------------------------------------------------------
-- Mirrors notification_deliveries, but keyed by session instead of assignment.
-- The unique key includes `starts_at`, so a rescheduled session produces a new
-- logical reminder while repeated scheduler runs stay idempotent.
CREATE TABLE IF NOT EXISTS public.discussion_session_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.discussion_sessions (id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  starts_at timestamptz NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT discussion_session_reminders_type_allowed CHECK (reminder_type IN ('24h', '3h')),
  CONSTRAINT discussion_session_reminders_status_allowed CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'skipped')
  ),
  CONSTRAINT discussion_session_reminders_attempts_range CHECK (attempt_count BETWEEN 0 AND 10),
  CONSTRAINT discussion_session_reminders_error_length CHECK (
    last_error_category IS NULL
    OR char_length(last_error_category) BETWEEN 1 AND 40
  ),
  CONSTRAINT discussion_session_reminders_dedupe UNIQUE (user_id, session_id, reminder_type, starts_at)
);


COMMENT ON TABLE public.discussion_session_reminders IS 'Durable session reminder ledger. No payload or subscription key is stored here.';


CREATE INDEX if NOT EXISTS discussion_session_reminders_due_idx ON public.discussion_session_reminders (status, next_attempt_at);


CREATE INDEX if NOT EXISTS discussion_session_reminders_user_idx ON public.discussion_session_reminders (user_id, created_at DESC);


CREATE TRIGGER discussion_session_reminders_set_updated_at
BEFORE UPDATE ON public.discussion_session_reminders FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- notification_preferences: session reminder windows
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS session_reminder_24h boolean NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS session_reminder_3h boolean NOT NULL DEFAULT TRUE;


COMMENT ON COLUMN public.notification_preferences.session_reminder_24h IS 'Send a push 24 hours before a discussion session the user is going to.';


COMMENT ON COLUMN public.notification_preferences.session_reminder_3h IS 'Send a push 3 hours before a discussion session the user is going to.';


-- ---------------------------------------------------------------------------
-- notification_events: session kinds
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_events
DROP CONSTRAINT if EXISTS notification_events_kind_allowed;


ALTER TABLE public.notification_events
ADD CONSTRAINT notification_events_kind_allowed CHECK (
  kind IN (
    'class_application_approved',
    'class_application_rejected',
    'class_admin_assigned',
    'class_invitation',
    'assignment_approved',
    'assignment_rejected',
    'submission_received',
    'moderation_required',
    'session_updated',
    'session_cancelled',
    'session_rsvp'
  )
);
