-- Courses covered by an absence request.
--
-- A class group holds many courses and a student is rarely absent from all of
-- them. `subject_ids` records exactly the courses the request covers, chosen by
-- the student. Existing rows keep an empty array, which preserves their old
-- meaning: the request applies to the whole class.
--
-- Writes stay behind a security-definer function because `leave_requests` never
-- receives INSERT/UPDATE grants; the trigger is the database's own guarantee
-- that a listed course really belongs to the request's class.
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS subject_ids UUID[] NOT NULL DEFAULT '{}'::UUID[];


ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_subject_count;


ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_subject_count CHECK (cardinality(subject_ids) <= 20);


COMMENT ON COLUMN public.leave_requests.subject_ids IS 'Courses of the request''s class that the absence covers. Empty means the whole class.';


-- ---------------------------------------------------------------------------
-- A covered course must belong to the request's class
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_leave_subjects_in_class () returns trigger language plpgsql
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_subject uuid;
BEGIN
  IF NEW.subject_ids IS NULL OR cardinality(NEW.subject_ids) = 0 THEN
    RETURN NEW;
  END IF;

  IF cardinality(NEW.subject_ids) <> (
    SELECT
      count(DISTINCT s)
    FROM
      unnest(NEW.subject_ids) AS s
  ) THEN
    RAISE EXCEPTION 'a course may only be listed once'
    USING ERRCODE = '22023';
  END IF;

  FOREACH v_subject IN ARRAY NEW.subject_ids LOOP
    IF NOT EXISTS (
      SELECT
        1
      FROM
        public.class_subjects cs
      WHERE
        cs.id = v_subject
        AND cs.class_id = NEW.class_id
    ) THEN
      RAISE EXCEPTION 'course % does not belong to this class', v_subject
      USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


COMMENT ON FUNCTION public.ensure_leave_subjects_in_class () IS 'Rejects covered courses that belong to another class or repeat.';


DROP TRIGGER IF EXISTS leave_requests_subjects_in_class ON public.leave_requests;


CREATE TRIGGER leave_requests_subjects_in_class
BEFORE INSERT OR UPDATE OF subject_ids,
class_id ON public.leave_requests FOR EACH ROW
EXECUTE FUNCTION public.ensure_leave_subjects_in_class ();


-- ---------------------------------------------------------------------------
-- set_leave_request_subjects
-- ---------------------------------------------------------------------------
-- Courses are saved separately from the editable fields so a retried save can
-- never file the request under a class the student did not choose.
CREATE OR REPLACE FUNCTION public.set_leave_request_subjects (p_request_id uuid, p_subject_ids UUID[]) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_ids uuid[] := coalesce(p_subject_ids, '{}'::uuid[]);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required'
    USING ERRCODE = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.leave_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found'
    USING ERRCODE = 'P0002';
  END IF;

  IF v_request.student_id <> v_user_id THEN
    RAISE EXCEPTION 'only the owner may change the covered courses'
    USING ERRCODE = '42501';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'this request can no longer be edited'
    USING ERRCODE = 'SS011';
  END IF;

  UPDATE public.leave_requests r
  SET
    subject_ids = v_ids
  WHERE
    r.id = p_request_id;
END;
$$;


COMMENT ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) IS 'Replaces the courses one draft absence request covers. Owner and draft only.';


REVOKE ALL ON FUNCTION public.set_leave_request_subjects (uuid, UUID[])
FROM
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) TO authenticated;


GRANT
SELECT
  (subject_ids) ON public.leave_requests TO authenticated;
