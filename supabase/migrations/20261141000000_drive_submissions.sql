-- Drive submissions: student picks a file from their own Google Drive,
-- we copy it to our storage (B2/R2/Supabase) and hand the lecturer a
-- share-token link. The lecturer never needs a StarsTask account or
-- access to the student's Drive. Token is the only secret.
CREATE TABLE IF NOT EXISTS public.drive_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  drive_file_id text,
  drive_file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  storage_path text NOT NULL,
  storage_provider text NOT NULL CHECK (storage_provider IN ('b2', 'r2', 'supabase')),
  source text NOT NULL DEFAULT 'google_drive' CHECK (source IN ('google_drive', 'upload')),
  share_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX if NOT EXISTS drive_submissions_assignment_idx ON public.drive_submissions (assignment_id);


CREATE INDEX if NOT EXISTS drive_submissions_user_idx ON public.drive_submissions (user_id);


CREATE INDEX if NOT EXISTS drive_submissions_token_idx ON public.drive_submissions (share_token);


ALTER TABLE public.drive_submissions enable ROW level security;


DROP POLICY if EXISTS drive_submissions_owner_all ON public.drive_submissions;


CREATE POLICY drive_submissions_owner_all ON public.drive_submissions FOR ALL TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
)
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


-- No public policy: lecturer access goes through the share token and the
-- service-role client in the /d/[token] route, never through anon/auth RLS.
REVOKE ALL ON public.drive_submissions
FROM
  anon,
  public;


GRANT
SELECT
,
  insert,
UPDATE,
delete ON public.drive_submissions TO authenticated;
