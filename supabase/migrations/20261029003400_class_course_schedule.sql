-- Weekly course schedule (jadwal matakuliah) per class.
--
-- Each row is one recurring weekly meeting slot: which subject, which day,
-- start and end wall-clock time, room, and an optional per-row lecturer
-- override. Times are `time` (no zone) because a weekly timetable is defined
-- in wall-clock time and Indonesia has no DST; the class timezone applies.
--
-- Access model (owner decision): every class member can read and edit the
-- schedule; platform admins can too. RLS reuses `is_class_member`.
CREATE TABLE IF NOT EXISTS public.class_course_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  lecturer_name text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_course_schedules_day_allowed CHECK (day_of_week BETWEEN 1 AND 7),
  -- `time` values compare naturally, so end after start is a plain comparison.
  CONSTRAINT class_course_schedules_time_window CHECK (end_time > start_time),
  CONSTRAINT class_course_schedules_room_length CHECK (
    room IS NULL
    OR char_length(btrim(room)) BETWEEN 1 AND 120
  ),
  CONSTRAINT class_course_schedules_lecturer_length CHECK (
    lecturer_name IS NULL
    OR char_length(btrim(lecturer_name)) BETWEEN 1 AND 120
  )
);


COMMENT ON TABLE public.class_course_schedules IS 'Recurring weekly meeting slots for the subjects of a class. day_of_week: 1=Monday .. 7=Sunday; times are class-local wall clock.';


CREATE INDEX IF NOT EXISTS class_course_schedules_class_day_idx ON public.class_course_schedules (class_id, day_of_week ASC, start_time ASC);


CREATE INDEX IF NOT EXISTS class_course_schedules_subject_idx ON public.class_course_schedules (subject_id);


CREATE TRIGGER class_course_schedules_set_updated_at
BEFORE UPDATE ON public.class_course_schedules FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_course_schedules ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.class_course_schedules
FROM
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE,
DELETE ON public.class_course_schedules TO authenticated;


DROP POLICY IF EXISTS class_course_schedules_member_read ON public.class_course_schedules;


CREATE POLICY class_course_schedules_member_read ON public.class_course_schedules FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


-- Any member may maintain the schedule (owner decision: "semua anggota").
DROP POLICY IF EXISTS class_course_schedules_member_insert ON public.class_course_schedules;


CREATE POLICY class_course_schedules_member_insert ON public.class_course_schedules FOR INSERT TO authenticated
WITH
  CHECK (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS class_course_schedules_member_update ON public.class_course_schedules;


CREATE POLICY class_course_schedules_member_update ON public.class_course_schedules
FOR UPDATE
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  )
WITH
  CHECK (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS class_course_schedules_member_delete ON public.class_course_schedules;


CREATE POLICY class_course_schedules_member_delete ON public.class_course_schedules FOR DELETE TO authenticated USING (
  public.is_class_member (class_id)
  OR public.is_platform_admin ()
);
