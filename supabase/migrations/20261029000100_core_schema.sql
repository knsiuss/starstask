-- StarsTask core schema.
-- Everything here is idempotent-friendly for a fresh project; use the Supabase
-- CLI (`supabase db push`) or the SQL editor to apply in order.
CREATE EXTENSION if NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at () returns trigger language plpgsql
SET
  search_path = '' AS $$ begin new.updated_at := now();
return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'StarsTask member',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_display_name_length CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  CONSTRAINT profiles_avatar_url_https CHECK (
    avatar_url IS NULL
    OR avatar_url LIKE 'https://%'
  )
);


COMMENT ON TABLE public.profiles IS 'Public contributor identity. One row per auth.users row, provisioned by trigger.';


CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  department text,
  normalized_name text generated always AS (lower(btrim(name))) stored,
  normalized_code text generated always AS (nullif(lower(btrim(coalesce(code, ''))), '')) stored,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT courses_code_length CHECK (
    code IS NULL
    OR char_length(btrim(code)) BETWEEN 1 AND 20
  ),
  CONSTRAINT courses_department_length CHECK (
    department IS NULL
    OR char_length(btrim(department)) BETWEEN 2 AND 120
  )
);


COMMENT ON TABLE public.courses IS 'Course catalogue. Read-only for clients; created through public.create_or_get_course().';


CREATE UNIQUE INDEX if NOT EXISTS courses_normalized_name_key ON public.courses (normalized_name);


CREATE INDEX if NOT EXISTS courses_normalized_code_idx ON public.courses (normalized_code)
WHERE
  normalized_code IS NOT NULL;


-- ---------------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lecturer_name text,
  semester text,
  academic_year text,
  assignment_type text,
  deadline timestamptz,
  tags TEXT[] NOT NULL DEFAULT '{}',
  reference_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector generated always AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  CONSTRAINT assignments_title_length CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  CONSTRAINT assignments_description_length CHECK (char_length(btrim(description)) BETWEEN 10 AND 20000),
  CONSTRAINT assignments_lecturer_length CHECK (
    lecturer_name IS NULL
    OR char_length(btrim(lecturer_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT assignments_semester_length CHECK (
    semester IS NULL
    OR char_length(btrim(semester)) BETWEEN 1 AND 20
  ),
  CONSTRAINT assignments_academic_year_format CHECK (
    academic_year IS NULL
    OR academic_year ~ '^\d{4}/\d{4}$'
  ),
  CONSTRAINT assignments_type_allowed CHECK (
    assignment_type IS NULL
    OR assignment_type IN (
      'individual',
      'group',
      'lab',
      'project',
      'presentation',
      'exam',
      'other'
    )
  ),
  CONSTRAINT assignments_status_allowed CHECK (status IN ('published', 'pending')),
  CONSTRAINT assignments_tags_limit CHECK (coalesce(array_length(tags, 1), 0) <= 10),
  CONSTRAINT assignments_references_array CHECK (
    jsonb_typeof(reference_urls) = 'array'
    AND jsonb_array_length(reference_urls) <= 10
  )
);


COMMENT ON COLUMN public.assignments.status IS 'published = visible publicly; pending = owner-only. Moderation UI is not implemented in the MVP.';


CREATE INDEX if NOT EXISTS assignments_public_recent_idx ON public.assignments (created_at DESC)
WHERE
  status = 'published';


CREATE INDEX if NOT EXISTS assignments_deadline_idx ON public.assignments (deadline ASC NULLS LAST)
WHERE
  status = 'published';


CREATE INDEX if NOT EXISTS assignments_course_idx ON public.assignments (course_id);


CREATE INDEX if NOT EXISTS assignments_owner_recent_idx ON public.assignments (user_id, created_at DESC);


CREATE INDEX if NOT EXISTS assignments_tags_idx ON public.assignments USING gin (tags);


CREATE INDEX if NOT EXISTS assignments_search_idx ON public.assignments USING gin (search_vector);


CREATE TRIGGER assignments_set_updated_at
BEFORE UPDATE ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE OR REPLACE FUNCTION public.prevent_assignment_owner_change () returns trigger language plpgsql
SET
  search_path = '' AS $$ begin if new.user_id is distinct
from old.user_id then raise exception 'assignment ownership cannot be changed' using errcode = '42501';
end if;
return new;
end;
$$;


CREATE TRIGGER assignments_owner_immutable
BEFORE UPDATE ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.prevent_assignment_owner_change ();


-- ---------------------------------------------------------------------------
-- assignment_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_attachments_path_key UNIQUE (storage_path),
  CONSTRAINT assignment_attachments_mime_allowed CHECK (
    mime_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    )
  ),
  CONSTRAINT assignment_attachments_size CHECK (file_size BETWEEN 1 AND 10485760),
  CONSTRAINT assignment_attachments_filename_length CHECK (char_length(btrim(original_filename)) BETWEEN 1 AND 255)
);


CREATE INDEX if NOT EXISTS assignment_attachments_assignment_idx ON public.assignment_attachments (assignment_id);


-- ---------------------------------------------------------------------------
-- rate_limits (internal; no client policies, accessed only through a definer fn)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  CONSTRAINT rate_limits_key_length CHECK (char_length(key) BETWEEN 8 AND 200),
  CONSTRAINT rate_limits_hits_positive CHECK (hits > 0)
);


COMMENT ON TABLE public.rate_limits IS 'Fixed-window counters used by public.consume_rate_limit(). Never exposed to clients.';
