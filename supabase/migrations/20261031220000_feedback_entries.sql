-- In-app feedback.
--
-- Signed-in users can send a short note about a bug, a confusing screen, or an
-- idea. The page path is stored without a query string so an accidental token
-- or search term is not captured. Platform admins triage the queue; a user can
-- read only their own submissions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL,
  message text NOT NULL,
  page_path text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_entries_category_allowed CHECK (category IN ('bug', 'confusing', 'idea', 'other')),
  CONSTRAINT feedback_entries_status_allowed CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  CONSTRAINT feedback_entries_message_length CHECK (char_length(btrim(message)) BETWEEN 10 AND 2000),
  CONSTRAINT feedback_entries_page_path_length CHECK (
    page_path IS NULL
    OR char_length(page_path) BETWEEN 1 AND 200
  )
);


COMMENT ON TABLE public.feedback_entries IS 'In-app feedback from signed-in users. No email, name, or attached files are stored.';


CREATE INDEX IF NOT EXISTS feedback_entries_status_recent_idx ON public.feedback_entries (status, created_at DESC);


CREATE INDEX IF NOT EXISTS feedback_entries_user_recent_idx ON public.feedback_entries (user_id, created_at DESC);


CREATE TRIGGER feedback_entries_set_updated_at
BEFORE UPDATE ON public.feedback_entries FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.feedback_entries ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.feedback_entries
FROM
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT ON public.feedback_entries TO authenticated;


-- Only the triage status is writable, and only for platform admins.
GRANT
UPDATE (status) ON public.feedback_entries TO authenticated;


DROP POLICY IF EXISTS feedback_entries_owner_read ON public.feedback_entries;


CREATE POLICY feedback_entries_owner_read ON public.feedback_entries FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS feedback_entries_owner_insert ON public.feedback_entries;


CREATE POLICY feedback_entries_owner_insert ON public.feedback_entries FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS feedback_entries_admin_read ON public.feedback_entries;


CREATE POLICY feedback_entries_admin_read ON public.feedback_entries FOR
SELECT
  TO authenticated USING (public.is_platform_admin ());


DROP POLICY IF EXISTS feedback_entries_admin_update ON public.feedback_entries;


CREATE POLICY feedback_entries_admin_update ON public.feedback_entries
FOR UPDATE
  TO authenticated USING (public.is_platform_admin ())
WITH
  CHECK (public.is_platform_admin ());
