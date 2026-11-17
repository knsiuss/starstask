-- Persistent Google Drive OAuth connections (one per user).
-- Tokens encrypted AES-256-GCM server-side, never granted to clients.
-- Same pattern as google_calendar_connections.
CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  scope text NOT NULL,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  token_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  last_error_category text,
  drive_email text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_drive_connections_status_allowed CHECK (status IN ('connected', 'revoked', 'error')),
  CONSTRAINT google_drive_connections_scope_length CHECK (char_length(scope) BETWEEN 1 AND 500),
  CONSTRAINT google_drive_connections_access_cipher_length CHECK (char_length(access_token_ciphertext) BETWEEN 40 AND 4000),
  CONSTRAINT google_drive_connections_refresh_cipher_length CHECK (
    refresh_token_ciphertext IS NULL
    OR char_length(refresh_token_ciphertext) BETWEEN 40 AND 4000
  ),
  CONSTRAINT google_drive_connections_error_length CHECK (
    last_error_category IS NULL
    OR char_length(last_error_category) BETWEEN 1 AND 40
  )
);


COMMENT ON TABLE public.google_drive_connections IS 'Encrypted Google Drive OAuth credentials. Token columns never granted to clients.';


CREATE TRIGGER google_drive_connections_set_updated_at
BEFORE UPDATE ON public.google_drive_connections FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.google_drive_connections enable ROW level security;


REVOKE ALL ON public.google_drive_connections
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    user_id,
    scope,
    status,
    connected_at,
    last_refreshed_at,
    updated_at,
    last_error_category,
    drive_email
  ) ON public.google_drive_connections TO authenticated;


DROP POLICY if EXISTS google_drive_connections_owner_read ON public.google_drive_connections;


CREATE POLICY google_drive_connections_owner_read ON public.google_drive_connections FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );
