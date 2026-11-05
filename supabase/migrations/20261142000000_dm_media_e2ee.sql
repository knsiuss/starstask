-- DM media E2EE: encrypted attachments (image/video/files).
-- Files encrypted client-side with same conversation key, stored ciphertext in Storage.
-- Server sees only ciphertext + metadata. Bucket private, RLS participants only.
ALTER TABLE public.dm_messages
ADD COLUMN IF NOT EXISTS attachment_name text,
ADD COLUMN IF NOT EXISTS attachment_mime text,
ADD COLUMN IF NOT EXISTS attachment_size integer,
ADD COLUMN IF NOT EXISTS attachment_path text;


ALTER TABLE public.dm_messages
ADD CONSTRAINT dm_messages_attachment_size CHECK (
  attachment_size IS NULL
  OR (attachment_size BETWEEN 1 AND 26214400)
);


COMMENT ON COLUMN public.dm_messages.attachment_path IS 'Storage path of E2EE ciphertext (dm-media bucket). Decrypted client-side only.';


INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('dm-media', 'dm-media', FALSE)
ON CONFLICT (id) DO NOTHING;


CREATE POLICY dm_media_participant_read ON storage.objects FOR
SELECT
  TO authenticated USING (
    bucket_id = 'dm-media'
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p
      WHERE
        p.conversation_id = (storage.foldername (name)) [1]::uuid
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


CREATE POLICY dm_media_participant_insert ON storage.objects FOR INSERT TO authenticated
WITH
  CHECK (
    bucket_id = 'dm-media'
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p
      WHERE
        p.conversation_id = (storage.foldername (name)) [1]::uuid
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );
