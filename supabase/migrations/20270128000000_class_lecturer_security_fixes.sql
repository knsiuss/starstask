-- Security fixes for Class & Lecturer audit:
-- H-02: Scope schedule room/lecturer collision check by university_id
-- H-03: Enforce course_scope = 'selected' & immutable author/class/subject on course_comments
-- M-02: Enforce course_scope = 'selected' on course_grade_weights RLS
-- 1. Reusable helper: can current user access a specific subject in a class?
CREATE OR REPLACE FUNCTION public.can_access_course_subject (p_class_id uuid, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT
    public.is_class_admin (p_class_id)
    OR EXISTS (
      SELECT
        1
      FROM
        public.class_members m
      WHERE
        m.class_id = p_class_id
        AND m.user_id = (SELECT auth.uid ())
        AND (
          m.course_scope = 'all'
          OR EXISTS (
            SELECT
              1
            FROM
              public.class_member_courses c
            WHERE
              c.class_id = p_class_id
              AND c.user_id = (SELECT auth.uid ())
              AND c.subject_id = p_subject_id
          )
        )
    );
$$;


REVOKE ALL ON FUNCTION public.can_access_course_subject (uuid, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.can_access_course_subject (uuid, uuid) TO authenticated;


-- 2. H-02: Scope room/lecturer schedule collision checks to the same university (or same class when university_id is NULL)
CREATE OR REPLACE FUNCTION public.check_class_course_schedule_collision () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
DECLARE
  v_conflict_start time;
  v_conflict_end time;
  v_university_id uuid;
BEGIN
  SELECT
    c.university_id INTO v_university_id
  FROM
    public.classes c
  WHERE
    c.id = NEW.class_id;

  SELECT
    s.start_time,
    s.end_time INTO v_conflict_start,
    v_conflict_end
  FROM
    public.class_course_schedules s
    JOIN public.classes sc ON sc.id = s.class_id
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
        v_university_id IS NOT NULL
        AND sc.university_id = v_university_id
        AND (
          (
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


-- 3. H-03: Enforce course_scope on course_comments & prevent author_id/class_id/subject_id tampering
DROP POLICY IF EXISTS course_comments_select ON public.course_comments;


CREATE POLICY course_comments_select ON public.course_comments FOR
SELECT
  TO authenticated USING (public.can_access_course_subject (class_id, subject_id));


DROP POLICY IF EXISTS course_comments_insert ON public.course_comments;


CREATE POLICY course_comments_insert ON public.course_comments FOR INSERT TO authenticated
WITH
  CHECK (
    public.can_access_course_subject (class_id, subject_id)
    AND author_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS course_comments_update ON public.course_comments;


CREATE POLICY course_comments_update ON public.course_comments
FOR UPDATE
  TO authenticated USING (
    author_id = (
      SELECT
        auth.uid ()
    )
    OR public.is_class_admin (class_id)
  )
WITH
  CHECK (public.can_access_course_subject (class_id, subject_id));


CREATE OR REPLACE FUNCTION public.prevent_course_comment_identity_tampering () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.author_id IS DISTINCT FROM OLD.author_id
       OR NEW.class_id IS DISTINCT FROM OLD.class_id
       OR NEW.subject_id IS DISTINCT FROM OLD.subject_id THEN
      RAISE EXCEPTION 'cannot change comment author, class, or subject' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS course_comments_immutable_scope ON public.course_comments;


CREATE TRIGGER course_comments_immutable_scope
BEFORE UPDATE ON public.course_comments FOR EACH ROW
EXECUTE FUNCTION public.prevent_course_comment_identity_tampering ();


-- 4. M-02: Enforce course_scope on course_grade_weights RLS
DROP POLICY IF EXISTS course_grade_weights_member_read ON public.course_grade_weights;


CREATE POLICY course_grade_weights_member_read ON public.course_grade_weights FOR
SELECT
  TO authenticated USING (public.can_access_course_subject (class_id, subject_id));
