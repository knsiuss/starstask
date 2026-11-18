-- Multi-device E2EE key registry and Group Sender Keys for DMs.
-- Server stores only public keys, prekeys, and encrypted sender-key envelopes.
CREATE TABLE IF NOT EXISTS public.dm_device_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_label text NOT NULL,
  identity_public_key text NOT NULL,
  signed_prekey_public text NOT NULL,
  one_time_prekeys jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_device_keys_user_device_unique UNIQUE (user_id, device_id)
);


CREATE INDEX IF NOT EXISTS dm_device_keys_user_active_idx ON public.dm_device_keys (user_id, revoked_at)
WHERE
  revoked_at IS NULL;


CREATE TABLE IF NOT EXISTS public.dm_sender_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  owner_device_id text NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_device_id text NOT NULL,
  key_id text NOT NULL,
  encrypted_sender_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_sender_keys_unique UNIQUE (
    conversation_id,
    owner_user_id,
    owner_device_id,
    recipient_user_id,
    recipient_device_id,
    key_id
  )
);


CREATE INDEX IF NOT EXISTS dm_sender_keys_conv_recipient_idx ON public.dm_sender_keys (conversation_id, recipient_user_id, recipient_device_id);


CREATE INDEX IF NOT EXISTS dm_sender_keys_conv_owner_idx ON public.dm_sender_keys (conversation_id, owner_user_id, key_id);


ALTER TABLE public.dm_device_keys ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.dm_sender_keys ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_device_keys_read ON public.dm_device_keys FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      revoked_at IS NULL
      AND EXISTS (
        SELECT
          1
        FROM
          public.dm_participants p_self
          JOIN public.dm_participants p_peer ON p_peer.conversation_id = p_self.conversation_id
        WHERE
          p_self.user_id = (
            SELECT
              auth.uid ()
          )
          AND p_self.left_at IS NULL
          AND p_peer.user_id = dm_device_keys.user_id
          AND p_peer.left_at IS NULL
      )
    )
  );


CREATE POLICY dm_device_keys_own_insert ON public.dm_device_keys FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


CREATE POLICY dm_device_keys_own_update ON public.dm_device_keys
FOR UPDATE
  TO authenticated USING (
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


CREATE POLICY dm_sender_keys_participant_read ON public.dm_sender_keys FOR
SELECT
  TO authenticated USING (
    (
      recipient_user_id = (
        SELECT
          auth.uid ()
      )
      OR owner_user_id = (
        SELECT
          auth.uid ()
      )
    )
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p
      WHERE
        p.conversation_id = dm_sender_keys.conversation_id
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
        AND p.left_at IS NULL
    )
  );


CREATE POLICY dm_sender_keys_owner_insert ON public.dm_sender_keys FOR INSERT TO authenticated
WITH
  CHECK (
    owner_user_id = (
      SELECT
        auth.uid ()
    )
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p_owner
      WHERE
        p_owner.conversation_id = dm_sender_keys.conversation_id
        AND p_owner.user_id = (
          SELECT
            auth.uid ()
        )
        AND p_owner.left_at IS NULL
    )
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p_rec
      WHERE
        p_rec.conversation_id = dm_sender_keys.conversation_id
        AND p_rec.user_id = dm_sender_keys.recipient_user_id
        AND p_rec.left_at IS NULL
    )
  );


CREATE POLICY dm_sender_keys_owner_update ON public.dm_sender_keys
FOR UPDATE
  TO authenticated USING (
    owner_user_id = (
      SELECT
        auth.uid ()
    )
  )
WITH
  CHECK (
    owner_user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.dm_device_keys
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE ON TABLE public.dm_device_keys TO authenticated;


REVOKE ALL ON TABLE public.dm_sender_keys
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE ON TABLE public.dm_sender_keys TO authenticated;


COMMENT ON TABLE public.dm_device_keys IS 'Per-device E2EE public identity keys, signed prekeys, and one-time prekeys.';


COMMENT ON TABLE public.dm_sender_keys IS 'Encrypted Group Sender Key envelopes per (conversation, owner device, recipient device, key_id).';


-- Multi-device v2 envelopes can exceed 8000 chars when a user has several linked devices.
ALTER TABLE public.dm_messages
DROP CONSTRAINT IF EXISTS dm_messages_body_length;


ALTER TABLE public.dm_messages
ADD CONSTRAINT dm_messages_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 32000);
