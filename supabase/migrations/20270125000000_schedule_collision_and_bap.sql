-- Schedule time-slot collision enforcement and BAP / meeting-count tracking.
-- ---------------------------------------------------------------------------
-- 1. Schedule collision check on public.class_course_schedules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_class_course_schedule_collision () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
DECLARE
  v_conflict_start time;
  v_conflict_end time;
BEGIN
  SELECT
    s.start_time,
    s.end_time INTO v_conflict_start,
    v_conflict_end
  FROM
    public.class_course_schedules s
  WHERE
    s.id IS DISTINCT FROM NEW.id
    AND s.day_of_week = NEW.day_of_week
    AND NEW.start_time < s.end_time
    AND NEW.end_time > s.start_time
    AND (
      NEW.start_date IS NULL
      OR s.end_date IS NULL
      OR NEW.start_date <= s.end_date
    )
    AND (
      NEW.end_date IS NULL
      OR s.start_date IS NULL
      OR NEW.end_date >= s.start_date
    )
    AND (
      s.class_id = NEW.class_id
      OR (
        NEW.room IS NOT NULL
        AND btrim(NEW.room) <> ''
        AND s.room IS NOT NULL
        AND lower(btrim(s.room)) = lower(btrim(NEW.room))
      )
      OR (
        NEW.lecturer_name IS NOT NULL
        AND btrim(NEW.lecturer_name) <> ''
        AND s.lecturer_name IS NOT NULL
        AND lower(btrim(s.lecturer_name)) = lower(btrim(NEW.lecturer_name))
      )
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Schedule time slot overlaps with an existing slot (% - %)', to_char(v_conflict_start, 'HH24:MI'), to_char(v_conflict_end, 'HH24:MI')
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;


COMMENT ON FUNCTION public.check_class_course_schedule_collision () IS 'Prevents overlapping weekly schedule slots (start_time < existing_end AND end_time > existing_start) within the same class, room, or lecturer.';


DROP TRIGGER IF EXISTS class_course_schedules_collision_trg ON public.class_course_schedules;


CREATE TRIGGER class_course_schedules_collision_trg
BEFORE INSERT OR UPDATE ON public.class_course_schedules FOR EACH ROW
EXECUTE FUNCTION public.check_class_course_schedule_collision ();


-- ---------------------------------------------------------------------------
-- 2. BAP (Berita Acara Perkuliahan) & meeting count target on attendance_meetings
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_meetings
ADD COLUMN IF NOT EXISTS bap_topic text,
ADD COLUMN IF NOT EXISTS bap_notes text,
ADD COLUMN IF NOT EXISTS target_meetings integer NOT NULL DEFAULT 14;


ALTER TABLE public.attendance_meetings
DROP CONSTRAINT IF EXISTS attendance_meetings_bap_topic_length;


ALTER TABLE public.attendance_meetings
ADD CONSTRAINT attendance_meetings_bap_topic_length CHECK (
  bap_topic IS NULL
  OR char_length(btrim(bap_topic)) BETWEEN 1 AND 300
);


ALTER TABLE public.attendance_meetings
DROP CONSTRAINT IF EXISTS attendance_meetings_bap_notes_length;


ALTER TABLE public.attendance_meetings
ADD CONSTRAINT attendance_meetings_bap_notes_length CHECK (
  bap_notes IS NULL
  OR char_length(btrim(bap_notes)) <= 2000
);


ALTER TABLE public.attendance_meetings
DROP CONSTRAINT IF EXISTS attendance_meetings_target_meetings_range;


ALTER TABLE public.attendance_meetings
ADD CONSTRAINT attendance_meetings_target_meetings_range CHECK (target_meetings BETWEEN 1 AND 32);


-- Helper view summarizing meetings held vs target (14-16) and BAP completion
-- per course offering. Uses security_invoker so RLS on underlying tables applies.
CREATE OR REPLACE VIEW public.offering_bap_progress
WITH
  (security_invoker = TRUE) AS
SELECT
  co.id AS offering_id,
  co.class_id,
  co.course_id,
  count(am.id) FILTER (
    WHERE
      am.status IN ('open', 'closed')
  )::integer AS meetings_held,
  count(am.id) FILTER (
    WHERE
      am.status IN ('open', 'closed')
      AND am.bap_topic IS NOT NULL
      AND btrim(am.bap_topic) <> ''
  )::integer AS meetings_with_bap,
  coalesce(max(am.target_meetings), 14)::integer AS target_meetings
FROM
  public.course_offerings co
  LEFT JOIN public.attendance_meetings am ON am.offering_id = co.id
GROUP BY
  co.id,
  co.class_id,
  co.course_id;


COMMENT ON VIEW public.offering_bap_progress IS 'Tracks meetings held, BAP topic completion, and target meetings (default 14) per course offering.';
