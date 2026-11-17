-- Class Group architecture: course codes must be unique inside one class.
--
-- `class_subjects.code` is optional, so the constraint is a partial unique
-- index: courses without a code never conflict, while every course that does
-- carry a code owns it inside its class group alone. The expression index
-- normalises case and surrounding whitespace, so "PW", "pw " and "Pw" collide.
--
-- Archived courses keep occupying their code on purpose: the code is part of
-- the historical record (assignments, attendance meetings, recaps point at
-- that course), and re-issuing it to a new course would blur which archive a
-- reader is looking at.
CREATE UNIQUE INDEX IF NOT EXISTS class_subjects_class_code_uniq ON public.class_subjects (class_id, lower(btrim(code)))
WHERE
  code IS NOT NULL;


COMMENT ON INDEX class_subjects_class_code_uniq IS 'A course code identifies at most one course inside a class group (case- and whitespace-insensitive). Courses without a code are exempt.';
