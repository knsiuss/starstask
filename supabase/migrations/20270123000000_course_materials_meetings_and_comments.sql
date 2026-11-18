-- ---------------------------------------------------------------------------
-- Course materials per meeting (Pertemuan 1..16), rich formats (Markdown/HTML/PDF),
-- and YouTube-style course comments with image attachments & emoji reactions.
-- ---------------------------------------------------------------------------
ALTER TABLE public.course_materials
ADD COLUMN IF NOT EXISTS meeting_number integer NULL CHECK (
  meeting_number IS NULL
  OR (
    meeting_number >= 1
    AND meeting_number <= 16
  )
),
ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html', 'plain')),
ADD COLUMN IF NOT EXISTS file_path text NULL,
ADD COLUMN IF NOT EXISTS file_name text NULL,
ADD COLUMN IF NOT EXISTS file_mime text NULL,
ADD COLUMN IF NOT EXISTS file_size bigint NULL;


CREATE INDEX IF NOT EXISTS idx_course_materials_meeting ON public.course_materials (class_id, subject_id, meeting_number, created_at DESC);


CREATE TABLE IF NOT EXISTS public.course_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  meeting_number integer NULL CHECK (
    meeting_number IS NULL
    OR (
      meeting_number >= 1
      AND meeting_number <= 16
    )
  ),
  parent_id uuid NULL REFERENCES public.course_comments (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  image_path text NULL,
  image_mime text NULL,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_course_comments_lookup ON public.course_comments (class_id, subject_id, meeting_number, created_at ASC);


CREATE INDEX IF NOT EXISTS idx_course_comments_parent ON public.course_comments (parent_id)
WHERE
  parent_id IS NOT NULL;


ALTER TABLE public.course_comments ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS course_comments_select ON public.course_comments;


CREATE POLICY course_comments_select ON public.course_comments FOR
SELECT
  TO authenticated USING (public.is_class_member (class_id));


DROP POLICY IF EXISTS course_comments_insert ON public.course_comments;


CREATE POLICY course_comments_insert ON public.course_comments FOR INSERT TO authenticated
WITH
  CHECK (
    public.is_class_member (class_id)
    AND author_id = auth.uid ()
  );


DROP POLICY IF EXISTS course_comments_update ON public.course_comments;


CREATE POLICY course_comments_update ON public.course_comments
FOR UPDATE
  TO authenticated USING (
    author_id = auth.uid ()
    OR public.is_class_admin (class_id)
  )
WITH
  CHECK (public.is_class_member (class_id));


DROP POLICY IF EXISTS course_comments_delete ON public.course_comments;


CREATE POLICY course_comments_delete ON public.course_comments FOR DELETE TO authenticated USING (
  author_id = auth.uid ()
  OR public.is_class_admin (class_id)
);


INSERT INTO
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'course-media',
    'course-media',
    FALSE,
    10485760,
    ARRAY[
      'application/pdf',
      'text/html',
      'text/markdown',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]
  )
ON CONFLICT (id) DO NOTHING;
