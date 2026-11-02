-- Course-scoped academic content.
--
-- A class group holds courses; assignments, attendance meetings, schedule
-- entries, and learning materials belong to exactly one course. This migration
-- adds the missing learning-material table and closes the remaining holes that
-- allowed new class-level content or content in an archived course.
--
-- Existing records are never reassigned. Assignments created before the course
-- requirement stay readable without a course and are not moved to an arbitrary
-- one.

-- ---------------------------------------------------------------------------
-- course_materials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'document',
  title text NOT NULL,
  description text,
  resource_url text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_materials_kind_allowed CHECK (kind IN ('document', 'video', 'link', 'other')),
  CONSTRAINT course_materials_title_length CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT course_materials_description_length CHECK (
    description IS NULL
    OR char_length(btrim(description)) BETWEEN 1 AND 5000
  ),
  CONSTRAINT course_materials_url_https CHECK (
    resource_url IS NULL
    OR resource_url ~ '^https://[^[:space:]]{8,2048}$'
  ),
  CONSTRAINT course_materials_has_content CHECK (
    description IS NOT NULL
    OR resource_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS course_materials_subject_idx ON public.course_materials (subject_id, created_at DESC);

COMMENT ON TABLE public.course_materials IS 'Learning materials attached to one course inside a class group.';

CREATE TRIGGER course_materials_set_updated_at
BEFORE UPDATE ON public.course_materials FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- A material must belong to a course of the same class
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS course_materials_subject_in_class ON public.course_materials;

CREATE TRIGGER course_materials_subject_in_class BEFORE INSERT
OR UPDATE OF subject_id,
class_id ON public.course_materials FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_in_class ();

-- ---------------------------------------------------------------------------
-- New academic content cannot target an archived course
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_subject_active () returns trigger language plpgsql
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT
      1
    FROM
      public.class_subjects s
    WHERE
      s.id = NEW.subject_id
      AND s.status = 'archived'
  ) THEN
    RAISE EXCEPTION 'course % is archived and cannot receive new content',
    NEW.subject_id USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


COMMENT ON FUNCTION public.ensure_subject_active () IS 'Rejects new content attached to an archived course. Existing rows are untouched.';


DROP TRIGGER IF EXISTS assignments_subject_active ON public.assignments;

CREATE TRIGGER assignments_subject_active BEFORE INSERT
OR UPDATE OF subject_id ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_active ();


DROP TRIGGER IF EXISTS discussion_sessions_subject_active ON public.discussion_sessions;

CREATE TRIGGER discussion_sessions_subject_active BEFORE INSERT
OR UPDATE OF subject_id ON public.discussion_sessions FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_active ();


DROP TRIGGER IF EXISTS class_course_schedules_subject_active ON public.class_course_schedules;

CREATE TRIGGER class_course_schedules_subject_active BEFORE INSERT
OR UPDATE OF subject_id ON public.class_course_schedules FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_active ();


DROP TRIGGER IF EXISTS course_materials_subject_active ON public.course_materials;

CREATE TRIGGER course_materials_subject_active BEFORE INSERT
OR UPDATE OF subject_id ON public.course_materials FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_active ();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.course_materials enable ROW level security;

REVOKE ALL ON public.course_materials
FROM
  anon,
  authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON public.course_materials TO authenticated;

DROP POLICY IF EXISTS course_materials_member_read ON public.course_materials;

CREATE POLICY course_materials_member_read ON public.course_materials FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );

DROP POLICY IF EXISTS course_materials_manager_insert ON public.course_materials;

CREATE POLICY course_materials_manager_insert ON public.course_materials FOR insert TO authenticated
WITH
  CHECK (public.can_manage_class (class_id));

DROP POLICY IF EXISTS course_materials_manager_update ON public.course_materials;

CREATE POLICY course_materials_manager_update ON public.course_materials
FOR UPDATE
  TO authenticated USING (public.can_manage_class (class_id))
WITH
  CHECK (public.can_manage_class (class_id));

DROP POLICY IF EXISTS course_materials_manager_delete ON public.course_materials;

CREATE POLICY course_materials_manager_delete ON public.course_materials FOR delete TO authenticated USING (public.can_manage_class (class_id));

-- ---------------------------------------------------------------------------
-- submit_class_assignment: a course is required
-- ---------------------------------------------------------------------------
-- The signature is unchanged, so CREATE OR REPLACE updates the existing
-- function. Only the body gains the course checks.
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
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_id uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_class
  from
    public.classes
  where
    id = p_class_id;

  if not found then raise exception 'class not found' using errcode = 'P0002';
  end if;

  if v_class.status <> 'active' then raise exception 'class is not accepting submissions' using errcode = '22023';
  end if;

  if not public.is_class_member (p_class_id) then raise exception 'class membership required' using errcode = '42501';
  end if;

  if p_content_type = 'class_announcement'
  and not public.can_manage_class (p_class_id) then raise exception 'class admin required for announcements' using errcode = '42501';
  end if;

  if p_content_type not in ('lecturer_assignment', 'class_announcement') then raise exception 'unknown content type' using errcode = '22023';
  end if;

  -- Academic content is always course-scoped. This is the database backstop for
  -- the required course selector; it also keeps older rows valid because only
  -- new inserts pass through here.
  if p_subject_id is null then raise exception 'a course is required for class content' using errcode = '22023';
  end if;

  if not exists (
    select
      1
    from
      public.class_subjects cs
    where
      cs.id = p_subject_id
      and cs.class_id = p_class_id
  ) then raise exception 'subject does not belong to this class' using errcode = '22023';
  end if;

  insert into public.assignments (
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
values (
    btrim(p_title),
    btrim(p_description),
    v_class.course_id,
    v_user,
    p_class_id,
    p_subject_id,
    v_class.lecturer_name,
    v_class.semester,
    v_class.academic_year,
    p_assignment_type,
    p_content_type,
    nullif(btrim(coalesce(p_source_label, '')), ''),
    p_drive_url,
    p_deadline,
    coalesce(p_tags, '{}'),
    coalesce(p_reference_urls, '[]'::jsonb),
    'pending_review'
  )
returning
  id into v_id;

  insert into public.assignment_reviews (assignment_id, reviewer_id, decision)
values (v_id, v_user, 'submitted');

  perform public.record_audit(
    'assignment_submitted',
    'assignment',
    v_id,
    p_class_id,
    jsonb_build_object(
      'content_type', p_content_type,
      'subject_id', p_subject_id,
      'revision', 1
    )
  );

  return v_id;
end;
$$;


COMMENT ON FUNCTION public.submit_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb, text, text, text, uuid) IS 'Creates class content that must belong to a course of the same class.';

-- ---------------------------------------------------------------------------
-- delete_class_subject: refuse to detach academic history
-- ---------------------------------------------------------------------------
-- Deleting a course used to set assignments.subject_id to null and drop its
-- schedule rows, which silently moved academic work to the class level. A
-- course with recorded content must be archived instead; only an empty course
-- can be removed.
CREATE OR REPLACE FUNCTION public.delete_class_subject (p_subject_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_subject public.class_subjects;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_subject FROM public.class_subjects WHERE id = p_subject_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject not found' USING errcode = 'P0002';
  END IF;

  IF NOT public.can_manage_class(v_subject.class_id) THEN
    RAISE EXCEPTION 'class admin permissions required' USING errcode = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.assignments WHERE subject_id = p_subject_id)
    OR EXISTS (SELECT 1 FROM public.discussion_sessions WHERE subject_id = p_subject_id)
    OR EXISTS (SELECT 1 FROM public.course_materials WHERE subject_id = p_subject_id)
    OR EXISTS (SELECT 1 FROM public.class_calendar_events WHERE subject_id = p_subject_id) THEN
    RAISE EXCEPTION 'course has academic records; archive it instead' USING errcode = '23503';
  END IF;

  DELETE FROM public.class_subjects WHERE id = p_subject_id;

  PERFORM public.record_audit(
    'class_subject_deleted',
    'class_subject',
    p_subject_id,
    v_subject.class_id,
    jsonb_build_object('name', v_subject.name)
  );

  RETURN TRUE;
END;
$$;
