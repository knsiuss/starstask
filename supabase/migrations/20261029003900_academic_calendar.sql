-- Shared academic calendar.
--
-- Tables added here:
--   personal_calendar_events  a student's own events (study blocks, reminders)
--   class_calendar_events     official group events: exams, academic events,
--                             and one-off class meetings
--
-- Assignment deadlines are never copied into these tables: the calendar reads
-- them from `assignments` so a correction is visible immediately.
--
-- `class_course_schedules` keeps its recurring weekly definition. The calendar
-- expands those rows into dated occurrences at read time, so editing a slot
-- changes every future week.
--
-- All instants are stored as `timestamptz` with the IANA zone the author
-- intended. The app displays them in Asia/Jakarta for consistency.
CREATE TABLE IF NOT EXISTS public.personal_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  time_zone text NOT NULL DEFAULT 'Asia/Jakarta',
  location text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_calendar_events_title_length CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  CONSTRAINT personal_calendar_events_description_length CHECK (
    description IS NULL
    OR char_length(btrim(description)) BETWEEN 1 AND 2000
  ),
  CONSTRAINT personal_calendar_events_window CHECK (
    ends_at > starts_at
    AND ends_at <= starts_at + interval '30 days'
  ),
  CONSTRAINT personal_calendar_events_time_zone_length CHECK (char_length(btrim(time_zone)) BETWEEN 1 AND 64),
  CONSTRAINT personal_calendar_events_location_length CHECK (
    location IS NULL
    OR char_length(btrim(location)) BETWEEN 1 AND 200
  ),
  CONSTRAINT personal_calendar_events_status_allowed CHECK (status IN ('published', 'cancelled', 'archived'))
);


COMMENT ON TABLE public.personal_calendar_events IS 'Private events owned by one user. Visible only to that user through RLS.';


COMMENT ON COLUMN public.personal_calendar_events.status IS 'published = visible, cancelled = kept but struck through, archived = hidden from the calendar.';


CREATE INDEX IF NOT EXISTS personal_calendar_events_user_start_idx ON public.personal_calendar_events (user_id, starts_at ASC);


CREATE INDEX IF NOT EXISTS personal_calendar_events_user_live_idx ON public.personal_calendar_events (user_id, starts_at ASC)
WHERE
  status <> 'archived';


CREATE TRIGGER personal_calendar_events_set_updated_at
BEFORE UPDATE ON public.personal_calendar_events FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.personal_calendar_events ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.personal_calendar_events
FROM
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE,
DELETE ON public.personal_calendar_events TO authenticated;


DROP POLICY IF EXISTS personal_calendar_events_owner_read ON public.personal_calendar_events;


CREATE POLICY personal_calendar_events_owner_read ON public.personal_calendar_events FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS personal_calendar_events_owner_insert ON public.personal_calendar_events;


CREATE POLICY personal_calendar_events_owner_insert ON public.personal_calendar_events FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS personal_calendar_events_owner_update ON public.personal_calendar_events;


CREATE POLICY personal_calendar_events_owner_update ON public.personal_calendar_events
FOR UPDATE
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  )
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS personal_calendar_events_owner_delete ON public.personal_calendar_events;


CREATE POLICY personal_calendar_events_owner_delete ON public.personal_calendar_events FOR DELETE TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
);


-- ---------------------------------------------------------------------------
-- class_calendar_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.class_subjects (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  time_zone text NOT NULL DEFAULT 'Asia/Jakarta',
  location text,
  visibility text NOT NULL DEFAULT 'group',
  status text NOT NULL DEFAULT 'published',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_calendar_events_title_length CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  CONSTRAINT class_calendar_events_description_length CHECK (
    description IS NULL
    OR char_length(btrim(description)) BETWEEN 1 AND 5000
  ),
  CONSTRAINT class_calendar_events_type_allowed CHECK (event_type IN ('class_schedule', 'exam', 'academic_event')),
  CONSTRAINT class_calendar_events_window CHECK (
    ends_at > starts_at
    AND ends_at <= starts_at + interval '7 days'
  ),
  CONSTRAINT class_calendar_events_time_zone_length CHECK (char_length(btrim(time_zone)) BETWEEN 1 AND 64),
  CONSTRAINT class_calendar_events_location_length CHECK (
    location IS NULL
    OR char_length(btrim(location)) BETWEEN 1 AND 200
  ),
  CONSTRAINT class_calendar_events_visibility_allowed CHECK (visibility = 'group'),
  CONSTRAINT class_calendar_events_status_allowed CHECK (status IN ('published', 'cancelled', 'archived'))
);


COMMENT ON TABLE public.class_calendar_events IS 'Official group events created by class admins: exams, academic events, and one-off class meetings.';


COMMENT ON COLUMN public.class_calendar_events.status IS 'published = visible to the group, cancelled = kept and struck through, archived = hidden from the calendar but preserved.';


CREATE INDEX IF NOT EXISTS class_calendar_events_class_start_idx ON public.class_calendar_events (class_id, starts_at ASC);


CREATE INDEX IF NOT EXISTS class_calendar_events_subject_start_idx ON public.class_calendar_events (subject_id, starts_at ASC)
WHERE
  subject_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS class_calendar_events_live_idx ON public.class_calendar_events (class_id, starts_at ASC)
WHERE
  status <> 'archived';


CREATE TRIGGER class_calendar_events_set_updated_at
BEFORE UPDATE ON public.class_calendar_events FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- A subject picked for an event must belong to the same class. The API checks
-- this too, but a direct write must not be able to attach another class's
-- subject and leak its name into this group's calendar.
CREATE OR REPLACE FUNCTION public.ensure_class_calendar_event_subject () returns trigger language plpgsql security definer
SET
  search_path = '' AS $$
BEGIN
  IF NEW.subject_id IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      public.class_subjects s
    WHERE
      s.id = NEW.subject_id
      AND s.class_id = NEW.class_id
  ) THEN
    RAISE EXCEPTION 'subject does not belong to this class'
    USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


REVOKE ALL ON function public.ensure_class_calendar_event_subject ()
FROM
  public,
  anon,
  authenticated;


CREATE TRIGGER class_calendar_events_subject_check
BEFORE INSERT OR UPDATE OF subject_id,
class_id ON public.class_calendar_events FOR EACH ROW
EXECUTE FUNCTION public.ensure_class_calendar_event_subject ();


ALTER TABLE public.class_calendar_events ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.class_calendar_events
FROM
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE,
DELETE ON public.class_calendar_events TO authenticated;


DROP POLICY IF EXISTS class_calendar_events_member_read ON public.class_calendar_events;


CREATE POLICY class_calendar_events_member_read ON public.class_calendar_events FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS class_calendar_events_admin_insert ON public.class_calendar_events;


CREATE POLICY class_calendar_events_admin_insert ON public.class_calendar_events FOR INSERT TO authenticated
WITH
  CHECK (
    public.is_class_admin (class_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS class_calendar_events_admin_update ON public.class_calendar_events;


CREATE POLICY class_calendar_events_admin_update ON public.class_calendar_events
FOR UPDATE
  TO authenticated USING (
    public.is_class_admin (class_id)
    OR public.is_platform_admin ()
  )
WITH
  CHECK (
    public.is_class_admin (class_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS class_calendar_events_admin_delete ON public.class_calendar_events;


CREATE POLICY class_calendar_events_admin_delete ON public.class_calendar_events FOR DELETE TO authenticated USING (
  public.is_class_admin (class_id)
  OR public.is_platform_admin ()
);
