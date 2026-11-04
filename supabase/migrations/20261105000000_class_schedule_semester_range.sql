-- Semester range for weekly schedule slots (PDF import).
--
-- The timetable source documents carry a class period (PERIODE) and the
-- dates the recurring slot runs (TGL MULAI/TGL SELESAI). The columns are
-- nullable because manually entered slots predate them and have no range.
ALTER TABLE public.class_course_schedules
ADD COLUMN IF NOT EXISTS period text,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date;


ALTER TABLE public.class_course_schedules
ADD CONSTRAINT class_course_schedules_period_length CHECK (
  period IS NULL
  OR char_length(btrim(period)) BETWEEN 1 AND 20
),
ADD CONSTRAINT class_course_schedules_date_range CHECK (
  start_date IS NULL
  OR end_date IS NULL
  OR end_date >= start_date
);


COMMENT ON COLUMN public.class_course_schedules.period IS 'Class period label from the source timetable (PERIODE), e.g. ''1''. Null for manually entered slots.';


COMMENT ON COLUMN public.class_course_schedules.start_date IS 'First date the recurring slot runs (TGL MULAI). Null when unknown.';


COMMENT ON COLUMN public.class_course_schedules.end_date IS 'Last date the recurring slot runs (TGL SELESAI). Null when unknown.';
