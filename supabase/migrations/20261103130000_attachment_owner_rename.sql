-- Renaming changes metadata only. The storage object path stays immutable so
-- existing signed URLs and audit references keep pointing at the same bytes.
GRANT
UPDATE (original_filename) ON public.assignment_attachments TO authenticated;


DROP POLICY if EXISTS assignment_attachments_owner_update ON public.assignment_attachments;


CREATE POLICY assignment_attachments_owner_update ON public.assignment_attachments
FOR UPDATE
  TO authenticated USING (
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
  )
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
  );
