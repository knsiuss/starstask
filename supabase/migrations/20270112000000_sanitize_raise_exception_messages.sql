-- Sanitize RAISE EXCEPTION text from three trigger functions so internal
-- UUIDs never reach the client when the message is surfaced. Encodings stay
-- identical to the originals so server-side branches and client mappings
-- (e.g. 23514 / 22023) keep behaving the same.
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
RAISE EXCEPTION 'The selected course does not belong to this class.' USING ERRCODE = '23514';
END IF;
RETURN NEW;
END;

$$;


COMMENT ON FUNCTION public.ensure_subject_in_class () IS 'Rejects a row whose subject_id points at a course owned by a different class.';


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
    RAISE EXCEPTION 'The selected course is archived and cannot receive new content.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


COMMENT ON FUNCTION public.ensure_subject_active () IS 'Rejects new content attached to an archived course. Existing rows are untouched.';


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
      RAISE EXCEPTION 'A covered course does not belong to this class.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NEW;
END;

$$;


COMMENT ON FUNCTION public.ensure_leave_subjects_in_class () IS 'Rejects covered courses that belong to another class or repeat.';
