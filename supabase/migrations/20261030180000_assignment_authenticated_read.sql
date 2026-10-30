-- Assignment content is available only to signed-in users. Keeping the policy
-- names stable also removes the legacy anonymous grants on a live database.
DROP POLICY IF EXISTS assignments_public_read ON public.assignments;


CREATE POLICY assignments_public_read ON public.assignments FOR
SELECT
  TO authenticated USING (status = 'published');


REVOKE
SELECT
  ON public.assignments
FROM
  anon;


DROP POLICY IF EXISTS assignment_attachments_read ON public.assignment_attachments;


CREATE POLICY assignment_attachments_read ON public.assignment_attachments FOR
SELECT
  TO authenticated USING (
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


REVOKE
SELECT
  ON public.assignment_attachments
FROM
  anon;


DROP POLICY IF EXISTS assignment_attachments_storage_read ON storage.objects;


CREATE POLICY assignment_attachments_storage_read ON storage.objects FOR
SELECT
  TO authenticated USING (
    bucket_id = 'assignment-attachments'
    AND (
      (
        SELECT
          auth.uid ()
      )::text = (storage.foldername (name)) [1]
      OR EXISTS (
        SELECT
          1
        FROM
          public.assignments a
        WHERE
          a.id = public.assignment_id_from_object_path (name)
          AND a.status = 'published'
      )
    )
  );


REVOKE ALL ON FUNCTION public.list_assignments (text, uuid, text, text, text, text, integer, integer, uuid)
FROM
  anon;
