-- Optional Google Calendar integration.
--
-- Tables added here:
--   google_calendar_connections      one encrypted OAuth credential per user
--   google_calendar_event_mappings   StarsTask session <-> Google event
--
-- Credentials are written and read only by server-side code holding the service
-- role. The token columns are encrypted with AES-256-GCM before they reach the
-- database and are never granted to `anon` or `authenticated`, so even a leaked
-- anon key cannot read them.
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  calendar_id text NOT NULL DEFAULT 'primary',
  scope text NOT NULL,
  -- `v1:<iv>:<tag>:<ciphertext>`, all base64. The key lives in the server
  -- environment, never in the database.
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  token_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  last_error_category text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_connections_status_allowed CHECK (status IN ('connected', 'revoked', 'error')),
  CONSTRAINT google_calendar_connections_calendar_id_length CHECK (char_length(btrim(calendar_id)) BETWEEN 1 AND 200),
  CONSTRAINT google_calendar_connections_scope_length CHECK (char_length(scope) BETWEEN 1 AND 500),
  CONSTRAINT google_calendar_connections_access_cipher_length CHECK (char_length(access_token_ciphertext) BETWEEN 40 AND 4000),
  CONSTRAINT google_calendar_connections_refresh_cipher_length CHECK (
    refresh_token_ciphertext IS NULL
    OR char_length(refresh_token_ciphertext) BETWEEN 40 AND 4000
  ),
  CONSTRAINT google_calendar_connections_error_length CHECK (
    last_error_category IS NULL
    OR char_length(last_error_category) BETWEEN 1 AND 40
  )
);


COMMENT ON TABLE public.google_calendar_connections IS 'Encrypted Google Calendar OAuth credentials. Token columns are never granted to clients.';


COMMENT ON COLUMN public.google_calendar_connections.scope IS 'Scopes Google actually granted, as returned by the token endpoint.';


CREATE TRIGGER google_calendar_connections_set_updated_at
BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE TABLE IF NOT EXISTS public.google_calendar_event_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.discussion_sessions (id) ON DELETE CASCADE,
  calendar_id text NOT NULL DEFAULT 'primary',
  google_event_id text,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One mapping per user and session: retrying a sync updates this row instead
  -- of creating a second event.
  CONSTRAINT google_calendar_event_mappings_user_session_key UNIQUE (user_id, session_id),
  CONSTRAINT google_calendar_event_mappings_status_allowed CHECK (
    status IN ('pending', 'synced', 'out_of_sync', 'failed', 'deleted')
  ),
  CONSTRAINT google_calendar_event_mappings_calendar_id_length CHECK (char_length(btrim(calendar_id)) BETWEEN 1 AND 200),
  CONSTRAINT google_calendar_event_mappings_event_id_length CHECK (
    google_event_id IS NULL
    OR char_length(google_event_id) BETWEEN 1 AND 1024
  ),
  CONSTRAINT google_calendar_event_mappings_attempts_range CHECK (attempt_count BETWEEN 0 AND 10),
  CONSTRAINT google_calendar_event_mappings_error_length CHECK (
    last_error_category IS NULL
    OR char_length(last_error_category) BETWEEN 1 AND 40
  ),
  -- A synced row must know which event it points at.
  CONSTRAINT google_calendar_event_mappings_synced_event CHECK (
    status <> 'synced'
    OR google_event_id IS NOT NULL
  )
);


COMMENT ON TABLE public.google_calendar_event_mappings IS 'Idempotency ledger for Google Calendar events. Written only by the server-side sync service.';


CREATE INDEX if NOT EXISTS google_calendar_event_mappings_due_idx ON public.google_calendar_event_mappings (status, next_attempt_at);


CREATE INDEX if NOT EXISTS google_calendar_event_mappings_user_idx ON public.google_calendar_event_mappings (user_id, updated_at DESC);


CREATE UNIQUE INDEX if NOT EXISTS google_calendar_event_mappings_event_key ON public.google_calendar_event_mappings (user_id, calendar_id, google_event_id)
WHERE
  google_event_id IS NOT NULL;


CREATE TRIGGER google_calendar_event_mappings_set_updated_at
BEFORE UPDATE ON public.google_calendar_event_mappings FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.google_calendar_connections enable ROW level security;


ALTER TABLE public.google_calendar_event_mappings enable ROW level security;


REVOKE ALL ON public.google_calendar_connections
FROM
  anon,
  authenticated;


-- Connection state is useful to the owner; the encrypted tokens are not part of
-- this grant and are therefore unreadable through the API.
GRANT
SELECT
  (
    user_id,
    calendar_id,
    status,
    connected_at,
    last_refreshed_at,
    updated_at,
    last_error_category
  ) ON public.google_calendar_connections TO authenticated;


DROP POLICY if EXISTS google_calendar_connections_owner_read ON public.google_calendar_connections;


CREATE POLICY google_calendar_connections_owner_read ON public.google_calendar_connections FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


REVOKE ALL ON public.google_calendar_event_mappings
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    session_id,
    calendar_id,
    google_event_id,
    status,
    attempt_count,
    last_synced_at,
    last_error_category,
    created_at,
    updated_at
  ) ON public.google_calendar_event_mappings TO authenticated;


DROP POLICY if EXISTS google_calendar_event_mappings_owner_read ON public.google_calendar_event_mappings;


CREATE POLICY google_calendar_event_mappings_owner_read ON public.google_calendar_event_mappings FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );
