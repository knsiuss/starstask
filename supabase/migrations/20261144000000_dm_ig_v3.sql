-- DM IG-like v3: stories, call signaling, theme, multi-device backup.
-- Additive only.
CREATE TABLE IF NOT EXISTS public.dm_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  mime text NOT NULL,
  path text NOT NULL,
  caption text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_stories_mime CHECK (
    mime LIKE 'image/%'
    OR mime LIKE 'video/%'
  )
);


CREATE INDEX IF NOT EXISTS dm_stories_user_expires_idx ON public.dm_stories (user_id, expires_at);


ALTER TABLE public.dm_stories ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_stories_read ON public.dm_stories FOR
SELECT
  TO authenticated USING (expires_at > now());


CREATE POLICY dm_stories_own_write ON public.dm_stories FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.dm_stories
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT ON TABLE public.dm_stories TO authenticated;


CREATE TABLE IF NOT EXISTS public.dm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'ringing',
  signal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT dm_calls_kind CHECK (kind IN ('audio', 'video')),
  CONSTRAINT dm_calls_status CHECK (
    status IN ('ringing', 'accepted', 'declined', 'ended', 'missed')
  )
);


ALTER TABLE public.dm_calls ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_calls_participant ON public.dm_calls FOR ALL TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.dm_participants p
    WHERE
      p.conversation_id = dm_calls.conversation_id
      AND p.user_id = (
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
        public.dm_participants p
      WHERE
        p.conversation_id = dm_calls.conversation_id
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


REVOKE ALL ON TABLE public.dm_calls
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE ON TABLE public.dm_calls TO authenticated;


ALTER TABLE public.dm_participants
ADD COLUMN IF NOT EXISTS theme text;


ALTER TABLE public.dm_participants
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;


CREATE TABLE IF NOT EXISTS public.dm_key_backup (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  wrapped_private_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.dm_key_backup ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_key_backup_own ON public.dm_key_backup FOR ALL TO authenticated USING (
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


REVOKE ALL ON TABLE public.dm_key_backup
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE ON TABLE public.dm_key_backup TO authenticated;


COMMENT ON TABLE public.dm_stories IS 'IG-like stories, 24h expiry, E2EE media ciphertext in dm-media bucket.';


COMMENT ON TABLE public.dm_calls IS 'WebRTC signaling only (SDP/ICE in signal column, E2EE at media layer via DTLS).';


COMMENT ON TABLE public.dm_key_backup IS 'Multi-device: private key wrapped with user passphrase, server stores ciphertext only.';
