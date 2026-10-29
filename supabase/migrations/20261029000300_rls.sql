-- Row Level Security and column-level grants.
-- Rule of thumb: every table reachable through PostgREST gets RLS enabled and
-- only the columns each role genuinely needs.
ALTER TABLE public.profiles enable ROW level security;


ALTER TABLE public.courses enable ROW level security;


ALTER TABLE public.assignments enable ROW level security;


ALTER TABLE public.assignment_attachments enable ROW level security;


ALTER TABLE public.rate_limits enable ROW level security;


-- ---------------------------------------------------------------------------
-- profiles: public display metadata, owner-only edits
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.profiles
FROM
  anon,
  authenticated;


GRANT
SELECT
  (id, display_name, avatar_url) ON public.profiles TO anon,
  authenticated;


GRANT
UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;


DROP POLICY if EXISTS profiles_public_read ON public.profiles;


CREATE POLICY profiles_public_read ON public.profiles FOR
SELECT
  TO anon,
  authenticated USING (TRUE);


DROP POLICY if EXISTS profiles_owner_update ON public.profiles;


CREATE POLICY profiles_owner_update ON public.profiles
FOR UPDATE
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = id
  )
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = id
  );


-- ---------------------------------------------------------------------------
-- courses: public read, no direct writes
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.courses
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.courses TO anon,
  authenticated;


DROP POLICY if EXISTS courses_public_read ON public.courses;


CREATE POLICY courses_public_read ON public.courses FOR
SELECT
  TO anon,
  authenticated USING (TRUE);


-- ---------------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.assignments
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.assignments TO anon,
  authenticated;


GRANT insert (
  title,
  description,
  course_id,
  user_id,
  lecturer_name,
  semester,
  academic_year,
  assignment_type,
  deadline,
  tags,
  reference_urls
) ON public.assignments TO authenticated;


GRANT
UPDATE (
  title,
  description,
  course_id,
  lecturer_name,
  semester,
  academic_year,
  assignment_type,
  deadline,
  tags,
  reference_urls
) ON public.assignments TO authenticated;


GRANT delete ON public.assignments TO authenticated;


DROP POLICY if EXISTS assignments_public_read ON public.assignments;


CREATE POLICY assignments_public_read ON public.assignments FOR
SELECT
  TO anon,
  authenticated USING (status = 'published');


DROP POLICY if EXISTS assignments_owner_read ON public.assignments;


CREATE POLICY assignments_owner_read ON public.assignments FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS assignments_owner_insert ON public.assignments;


CREATE POLICY assignments_owner_insert ON public.assignments FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS assignments_owner_update ON public.assignments;


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
  );


DROP POLICY if EXISTS assignments_owner_delete ON public.assignments;


CREATE POLICY assignments_owner_delete ON public.assignments FOR delete TO authenticated USING (
  (
    SELECT
      auth.uid ()
  ) = user_id
);


-- ---------------------------------------------------------------------------
-- assignment_attachments: readable when the parent assignment is public or
-- owned; writable only by the owner and only under their storage prefix.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.assignment_attachments
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.assignment_attachments TO anon,
  authenticated;


GRANT insert (
  assignment_id,
  storage_path,
  original_filename,
  mime_type,
  file_size
) ON public.assignment_attachments TO authenticated;


GRANT delete ON public.assignment_attachments TO authenticated;


DROP POLICY if EXISTS assignment_attachments_read ON public.assignment_attachments;


CREATE POLICY assignment_attachments_read ON public.assignment_attachments FOR
SELECT
  TO anon,
  authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND (
          a.status = 'published'
          OR a.user_id = (
            SELECT
              auth.uid ()
          )
        )
    )
  );


DROP POLICY if EXISTS assignment_attachments_owner_insert ON public.assignment_attachments;


CREATE POLICY assignment_attachments_owner_insert ON public.assignment_attachments FOR insert TO authenticated
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND a.user_id = (
          SELECT
            auth.uid ()
        )
    )
    AND storage_path LIKE (
      SELECT
        auth.uid ()
    )::text || '/' || assignment_id::text || '/%'
  );


DROP POLICY if EXISTS assignment_attachments_owner_delete ON public.assignment_attachments;


CREATE POLICY assignment_attachments_owner_delete ON public.assignment_attachments FOR delete TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.assignments a
    WHERE
      a.id = assignment_id
      AND a.user_id = (
        SELECT
          auth.uid ()
      )
  )
);


-- ---------------------------------------------------------------------------
-- rate_limits: internal only
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.rate_limits
FROM
  anon,
  authenticated;
