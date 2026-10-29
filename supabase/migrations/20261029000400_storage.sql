-- Private storage bucket for assignment attachments.
-- Object key convention: {owner_id}/{assignment_id}/{uuid}-{safe_filename}
-- Public downloads are served through short-lived signed URLs generated on the
-- server, never through public bucket access.
INSERT INTO
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'assignment-attachments',
    'assignment-attachments',
    FALSE,
    10485760,
    ARRAY[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    ]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


DROP POLICY if EXISTS assignment_attachments_storage_read ON storage.objects;


CREATE POLICY assignment_attachments_storage_read ON storage.objects FOR
SELECT
  TO anon,
  authenticated USING (
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


DROP POLICY if EXISTS assignment_attachments_storage_insert ON storage.objects;


CREATE POLICY assignment_attachments_storage_insert ON storage.objects FOR insert TO authenticated
WITH
  CHECK (
    bucket_id = 'assignment-attachments'
    AND (
      SELECT
        auth.uid ()
    )::text = (storage.foldername (name)) [1]
    AND EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = public.assignment_id_from_object_path (name)
        AND a.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


DROP POLICY if EXISTS assignment_attachments_storage_delete ON storage.objects;


CREATE POLICY assignment_attachments_storage_delete ON storage.objects FOR delete TO authenticated USING (
  bucket_id = 'assignment-attachments'
  AND (
    SELECT
      auth.uid ()
  )::text = (storage.foldername (name)) [1]
);
