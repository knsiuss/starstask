-- Lecturer subject scope: a lecturer may only manage the courses they teach,
-- while a non-lecturer class admin keeps full class-wide capability.
-- The subject<->lecturer link is an explicit user id, not a display name.
ALTER TABLE public.class_subjects
ADD COLUMN IF NOT EXISTS lecturer_user_id uuid;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_subjects_lecturer_user_id_fkey'
  ) THEN
    ALTER TABLE public.class_subjects
      ADD CONSTRAINT class_subjects_lecturer_user_id_fkey
      FOREIGN KEY (lecturer_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END
$$;


CREATE INDEX IF NOT EXISTS class_subjects_lecturer_user_id_idx ON public.class_subjects (class_id, lecturer_user_id);


-- Names are ambiguous by nature: backfill only when exactly one profile
-- matches, so a wrong user never silently gains access to a course.
WITH
  name_counts AS (
    SELECT
      lower(btrim(full_name)) AS normalized_name
    FROM
      public.profiles
    GROUP BY
      lower(btrim(full_name))
    HAVING
      count(*) = 1
  ),
  unique_lecturers AS (
    SELECT
      lower(btrim(p.full_name)) AS normalized_name,
      p.id AS user_id
    FROM
      public.profiles p
      JOIN name_counts nc ON nc.normalized_name = lower(btrim(p.full_name))
  )
UPDATE public.class_subjects s
SET
  lecturer_user_id = ul.user_id
FROM
  unique_lecturers ul
WHERE
  s.lecturer_user_id IS NULL
  AND s.lecturer_name IS NOT NULL
  AND lower(btrim(s.lecturer_name)) = ul.normalized_name;


CREATE OR REPLACE FUNCTION public.can_manage_subject (p_class_id uuid, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
  SELECT
    public.is_platform_admin ()
    OR (
      public.can_manage_class (p_class_id)
      AND (
        NOT public.is_lecturer ()
        OR EXISTS (
          SELECT 1
          FROM public.class_subjects s
          WHERE s.id = p_subject_id
            AND s.class_id = p_class_id
            AND s.lecturer_user_id = auth.uid ()
        )
      )
    );
$$;


REVOKE ALL ON FUNCTION public.can_manage_subject (uuid, uuid)
FROM
  PUBLIC;


GRANT
EXECUTE ON FUNCTION public.can_manage_subject (uuid, uuid) TO authenticated;


-- Course content and submissions follow the same subject scope.
CREATE OR REPLACE FUNCTION public.can_access_course_subject (p_class_id uuid, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
  SELECT
    public.is_platform_admin ()
    OR (
      public.is_lecturer ()
      AND public.can_manage_subject (p_class_id, p_subject_id)
    )
    OR (
      NOT public.is_lecturer ()
      AND (
        public.is_class_admin (p_class_id)
        OR EXISTS (
          SELECT 1
          FROM public.class_members m
          WHERE m.class_id = p_class_id
            AND m.user_id = auth.uid ()
            AND (
              m.course_scope = 'all'
              OR EXISTS (
                SELECT 1
                FROM public.class_member_courses c
                WHERE c.class_id = p_class_id
                  AND c.user_id = auth.uid ()
                  AND c.subject_id = p_subject_id
              )
            )
        )
      )
    );
$$;


-- Reader reports are visible to the reporter and to whoever may manage that
-- report's exact course - no longer to every admin of the whole class.
DROP POLICY IF EXISTS assignment_reports_select ON public.assignment_reports;


CREATE POLICY assignment_reports_select ON public.assignment_reports FOR
SELECT
  TO authenticated USING (
    reporter_id = auth.uid ()
    OR EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_reports.assignment_id
        AND public.can_manage_subject (a.class_id, a.subject_id)
    )
  );


DROP POLICY IF EXISTS class_subjects_manage_update ON public.class_subjects;


CREATE POLICY class_subjects_manage_update ON public.class_subjects
FOR UPDATE
  TO authenticated USING (public.can_manage_subject (class_id, id))
WITH
  CHECK (public.can_manage_subject (class_id, id));


-- A lecturer posting an assignment to their own course publishes it directly;
-- everyone else still goes through review.
CREATE OR REPLACE FUNCTION public.submit_class_assignment (
  p_class_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz DEFAULT NULL,
  p_assignment_type text DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_reference_urls jsonb DEFAULT '[]'::jsonb,
  p_content_type text DEFAULT 'lecturer_assignment',
  p_source_label text DEFAULT NULL,
  p_drive_url text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_class public.classes;
  v_subject public.class_subjects;
  v_auto_publish boolean;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_class
  FROM public.classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_class.status <> 'active' THEN
    RAISE EXCEPTION 'class is not accepting submissions' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_class_member (p_class_id) THEN
    RAISE EXCEPTION 'class membership required' USING ERRCODE = '42501';
  END IF;

  IF p_content_type = 'class_announcement'
     AND NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'class admin required for announcements' USING ERRCODE = '42501';
  END IF;

  IF p_content_type NOT IN ('lecturer_assignment', 'class_announcement') THEN
    RAISE EXCEPTION 'unknown content type' USING ERRCODE = '22023';
  END IF;

  IF p_subject_id IS NULL THEN
    RAISE EXCEPTION 'a course is required for class content' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_subject
  FROM public.class_subjects
  WHERE id = p_subject_id
    AND class_id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject does not belong to this class' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_access_course_subject (p_class_id, p_subject_id) THEN
    RAISE EXCEPTION 'not enrolled in this course' USING ERRCODE = '42501';
  END IF;

  v_auto_publish := p_content_type = 'lecturer_assignment'
    AND public.is_lecturer ()
    AND v_subject.lecturer_user_id = v_user
    AND public.can_manage_subject (p_class_id, p_subject_id);

  INSERT INTO public.assignments (
    title,
    description,
    course_id,
    user_id,
    class_id,
    subject_id,
    lecturer_name,
    semester,
    academic_year,
    assignment_type,
    content_type,
    source_label,
    drive_url,
    deadline,
    tags,
    reference_urls,
    status
  )
  VALUES (
    btrim(p_title),
    btrim(p_description),
    v_class.course_id,
    v_user,
    p_class_id,
    p_subject_id,
    coalesce(v_subject.lecturer_name, v_class.lecturer_name),
    v_class.semester,
    v_class.academic_year,
    p_assignment_type,
    p_content_type,
    nullif(btrim(coalesce(p_source_label, '')), ''),
    p_drive_url,
    p_deadline,
    coalesce(p_tags, '{}'),
    coalesce(p_reference_urls, '[]'::jsonb),
    CASE WHEN v_auto_publish THEN 'published' ELSE 'pending_review' END
  )
  RETURNING id INTO v_id;

  INSERT INTO public.assignment_reviews (assignment_id, reviewer_id, decision)
  VALUES (v_id, v_user, CASE WHEN v_auto_publish THEN 'approved' ELSE 'submitted' END);

  PERFORM public.record_audit (
    'assignment_submitted',
    'assignment',
    v_id,
    p_class_id,
    jsonb_build_object (
      'content_type', p_content_type,
      'subject_id', p_subject_id,
      'revision', 1,
      'auto_published', v_auto_publish
    )
  );

  RETURN v_id;
END;
$$;


COMMENT ON FUNCTION public.submit_class_assignment (
  uuid,
  text,
  text,
  timestamptz,
  text,
  TEXT[],
  jsonb,
  text,
  text,
  text,
  uuid
) IS 'Creates class content scoped to a course; lecturers publishing to their own course are auto-approved.';
