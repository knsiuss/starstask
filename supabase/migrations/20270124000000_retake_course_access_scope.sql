-- ---------------------------------------------------------------------------
-- Per-member course access scope for retake students (mahasiswa mengulang).
--
-- Default `course_scope = 'all'` preserves full access for regular members.
-- When `course_scope = 'selected'`, the student only has access to courses
-- listed in `class_member_courses` and is excluded from attendance rosters
-- of all other courses in the class.
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_members
ADD COLUMN IF NOT EXISTS course_scope text NOT NULL DEFAULT 'all' CHECK (course_scope IN ('all', 'selected'));


CREATE TABLE IF NOT EXISTS public.class_member_courses (
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id, subject_id)
);


CREATE INDEX IF NOT EXISTS idx_class_member_courses_subject ON public.class_member_courses (class_id, subject_id, user_id);


ALTER TABLE public.class_member_courses ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS class_member_courses_select ON public.class_member_courses;


CREATE POLICY class_member_courses_select ON public.class_member_courses FOR
SELECT
  TO authenticated USING (
    user_id = auth.uid ()
    OR public.is_class_admin (class_id)
  );


DROP POLICY IF EXISTS class_member_courses_insert ON public.class_member_courses;


CREATE POLICY class_member_courses_insert ON public.class_member_courses FOR INSERT TO authenticated
WITH
  CHECK (public.is_class_admin (class_id));


DROP POLICY IF EXISTS class_member_courses_delete ON public.class_member_courses;


CREATE POLICY class_member_courses_delete ON public.class_member_courses FOR DELETE TO authenticated USING (public.is_class_admin (class_id));
