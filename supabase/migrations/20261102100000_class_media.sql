-- Class identity media: an optional profile image and a cover image.
--
-- Both are public object URLs in the `class-media` bucket. They are readable by
-- anyone who can read the class, and writable only through set_class_media(),
-- which checks class admin rights for the target class.
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS avatar_url text;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS cover_url text;


-- Only absolute https URLs are accepted, so a stored value can never be a
-- javascript: or data: payload rendered into a class page.
ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_avatar_url_https;


ALTER TABLE public.classes
ADD CONSTRAINT classes_avatar_url_https CHECK (
  avatar_url IS NULL
  OR avatar_url ~ '^https://[^[:space:]]+$'
);


ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_cover_url_https;


ALTER TABLE public.classes
ADD CONSTRAINT classes_cover_url_https CHECK (
  cover_url IS NULL
  OR cover_url ~ '^https://[^[:space:]]+$'
);


COMMENT ON COLUMN public.classes.avatar_url IS 'Public object URL of the class profile image. NULL means the default placeholder.';


COMMENT ON COLUMN public.classes.cover_url IS 'Public object URL of the class cover image. NULL means the default gradient.';


GRANT
SELECT
  (avatar_url, cover_url) ON public.classes TO anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- set_class_media: the only write path for the two image columns
-- ---------------------------------------------------------------------------
-- Both values are written together, so the caller always sends the full desired
-- state: an omitted (or NULL) argument clears that image.
CREATE OR REPLACE FUNCTION public.set_class_media (
  p_class_id uuid,
  p_avatar_url text DEFAULT NULL,
  p_cover_url text DEFAULT NULL
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (
    SELECT
      auth.uid ()
  );
BEGIN IF v_actor IS NULL THEN
  RAISE EXCEPTION 'authentication required'
  USING
    ERRCODE = '42501';
END IF;
IF NOT (
  public.is_platform_admin ()
  OR public.is_class_admin (p_class_id)
) THEN
  RAISE EXCEPTION 'class admin required'
  USING
    ERRCODE = '42501';
END IF;
UPDATE public.classes
SET
  avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), ''),
  cover_url = nullif(btrim(coalesce(p_cover_url, '')), '')
WHERE
  id = p_class_id;
IF NOT found THEN
  RAISE EXCEPTION 'class not found'
  USING
    ERRCODE = 'P0002';
END IF;
PERFORM public.record_audit(
  'class_media_updated',
  'class',
  p_class_id,
  p_class_id,
  jsonb_build_object(
    'hasAvatar',
    p_avatar_url IS NOT NULL,
    'hasCover',
    p_cover_url IS NOT NULL
  )
);
END;

$$;


REVOKE ALL ON function public.set_class_media (uuid, text, text)
FROM
  public;


GRANT
EXECUTE ON function public.set_class_media (uuid, text, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Storage: public class-media bucket, class-admin scoped writes
-- ---------------------------------------------------------------------------
-- Object key convention: {class_id}/{uuid}.{ext}. The bucket is public because
-- these images are class identity, shown on pages any member can open.
INSERT INTO
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'class-media',
    'class-media',
    TRUE,
    4194304,
    ARRAY['image/png', 'image/jpeg']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


DROP POLICY IF EXISTS class_media_storage_read ON storage.objects;


CREATE POLICY class_media_storage_read ON storage.objects FOR
SELECT
  TO anon,
  authenticated USING (bucket_id = 'class-media');


DROP POLICY IF EXISTS class_media_storage_write ON storage.objects;


-- The first path segment must be a class the caller administers. Comparing the
-- folder as text avoids casting an attacker-chosen segment to uuid.
CREATE POLICY class_media_storage_write ON storage.objects FOR INSERT TO authenticated
WITH
  CHECK (
    bucket_id = 'class-media'
    AND EXISTS (
      SELECT
        1
      FROM
        public.class_admins ca
      WHERE
        ca.class_id::text = (storage.foldername (name)) [1]
        AND ca.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


DROP POLICY IF EXISTS class_media_storage_update ON storage.objects;


CREATE POLICY class_media_storage_update ON storage.objects
FOR UPDATE
  TO authenticated USING (
    bucket_id = 'class-media'
    AND EXISTS (
      SELECT
        1
      FROM
        public.class_admins ca
      WHERE
        ca.class_id::text = (storage.foldername (name)) [1]
        AND ca.user_id = (
          SELECT
            auth.uid ()
        )
    )
  )
WITH
  CHECK (
    bucket_id = 'class-media'
    AND EXISTS (
      SELECT
        1
      FROM
        public.class_admins ca
      WHERE
        ca.class_id::text = (storage.foldername (name)) [1]
        AND ca.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


DROP POLICY IF EXISTS class_media_storage_delete ON storage.objects;


CREATE POLICY class_media_storage_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'class-media'
  AND EXISTS (
    SELECT
      1
    FROM
      public.class_admins ca
    WHERE
      ca.class_id::text = (storage.foldername (name)) [1]
      AND ca.user_id = (
        SELECT
          auth.uid ()
      )
  )
);
