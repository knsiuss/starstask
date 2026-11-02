-- Close two class-isolation holes.
--
-- 1. `assignments` could be inserted or moved into any class: the RLS policy
--    only compared `user_id` with the caller, so a signed-in user could POST a
--    row straight to PostgREST with somebody else's `class_id`.
-- 2. `subject_id` had a single-column foreign key, so nothing stopped a row in
--    class B from pointing at a course that belongs to class A. The UI filters
--    on both ids, so such a row was invisible in the wrong place — but it was
--    still real data with an impossible relationship.

-- ---------------------------------------------------------------------------
-- 1. A subject must belong to the class the row is attached to
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_subject_in_class () returns trigger language plpgsql
SET
  search_path = public,
  pg_temp AS $$
BEGIN IF NEW.subject_id IS NULL
OR NEW.class_id IS NULL THEN RETURN NEW;
END IF;
IF NOT EXISTS (
  SELECT
    1
  FROM
    public.class_subjects s
  WHERE
    s.id = NEW.subject_id
    AND s.class_id = NEW.class_id
) THEN
RAISE EXCEPTION 'subject % does not belong to class %',
NEW.subject_id,
NEW.class_id USING ERRCODE = '23514';
END IF;
RETURN NEW;
END;

$$;


COMMENT ON FUNCTION public.ensure_subject_in_class () IS 'Rejects a row whose subject_id points at a course owned by a different class.';


DROP TRIGGER IF EXISTS assignments_subject_in_class ON public.assignments;


CREATE TRIGGER assignments_subject_in_class BEFORE INSERT
OR UPDATE OF subject_id,
class_id ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_in_class ();


DROP TRIGGER IF EXISTS discussion_sessions_subject_in_class ON public.discussion_sessions;


CREATE TRIGGER discussion_sessions_subject_in_class BEFORE INSERT
OR UPDATE OF subject_id,
class_id ON public.discussion_sessions FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_in_class ();


DROP TRIGGER IF EXISTS class_calendar_events_subject_in_class ON public.class_calendar_events;


CREATE TRIGGER class_calendar_events_subject_in_class BEFORE INSERT
OR UPDATE OF subject_id,
class_id ON public.class_calendar_events FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_in_class ();


DROP TRIGGER IF EXISTS class_course_schedules_subject_in_class ON public.class_course_schedules;


CREATE TRIGGER class_course_schedules_subject_in_class BEFORE INSERT
OR UPDATE OF subject_id,
class_id ON public.class_course_schedules FOR EACH ROW
EXECUTE FUNCTION public.ensure_subject_in_class ();


-- ---------------------------------------------------------------------------
-- 2. An assignment may only be written into a class the caller belongs to
-- ---------------------------------------------------------------------------
-- A NULL `class_id` stays allowed: those are the public, class-less
-- contributions the repository already accepts.
DROP POLICY IF EXISTS assignments_owner_insert ON public.assignments;


CREATE POLICY assignments_owner_insert ON public.assignments FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
    AND (
      class_id IS NULL
      OR public.is_class_member (class_id)
      OR public.is_class_admin (class_id)
      OR public.is_platform_admin ()
    )
  );


DROP POLICY IF EXISTS assignments_owner_update ON public.assignments;


CREATE POLICY assignments_owner_update ON public.assignments
FOR UPDATE
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  )
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
    AND (
      class_id IS NULL
      OR public.is_class_member (class_id)
      OR public.is_class_admin (class_id)
      OR public.is_platform_admin ()
    )
  );
