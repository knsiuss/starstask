-- DM v2: read receipts, edit/delete, reply, reactions, typing, group, key rotation.
-- Additive only. Forward secrecy: per-conversation epoch key (rotate every 100 msgs).
ALTER TABLE public.dm_messages
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.dm_messages (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS key_epoch integer NOT NULL DEFAULT 1;


CREATE TABLE IF NOT EXISTS public.dm_typing (
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_typing boolean NOT NULL DEFAULT TRUE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);


ALTER TABLE public.dm_typing ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_typing_participant ON public.dm_typing FOR ALL TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.dm_participants p
    WHERE
      p.conversation_id = dm_typing.conversation_id
      AND p.user_id = (
        SELECT
          auth.uid ()
      )
  )
)
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p
      WHERE
        p.conversation_id = dm_typing.conversation_id
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


REVOKE ALL ON TABLE public.dm_typing
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE,
DELETE ON TABLE public.dm_typing TO authenticated;


-- Group conversations
ALTER TABLE public.dm_conversations
ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT FALSE;


ALTER TABLE public.dm_conversations
ADD COLUMN IF NOT EXISTS group_name text;


-- group_key is per-member encrypted random key: store as text (base64 wrapped)
ALTER TABLE public.dm_conversations
ADD COLUMN IF NOT EXISTS group_key text;


CREATE TABLE IF NOT EXISTS public.dm_group_keys (
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  wrapped_key text NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);


ALTER TABLE public.dm_group_keys ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_group_keys_own ON public.dm_group_keys FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.dm_group_keys
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
  ON TABLE public.dm_group_keys TO authenticated;


-- Read receipt update helper
CREATE OR REPLACE FUNCTION public.dm_mark_read (p_conversation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
BEGIN
  UPDATE public.dm_participants SET last_read_at = now() WHERE conversation_id = p_conversation AND user_id = auth.uid();
END; $$;


REVOKE ALL ON FUNCTION public.dm_mark_read (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.dm_mark_read (uuid) TO authenticated;


COMMENT ON TABLE public.dm_typing IS 'Realtime typing indicator (polling 3s, expires after 10s).';


COMMENT ON COLUMN public.dm_messages.key_epoch IS 'Forward secrecy epoch: rotate conversation key every 100 messages.';
