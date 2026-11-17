-- E2EE keys for DM (WhatsApp-style, simplified).
-- Server only stores public keys + ciphertext. Private keys NEVER leave device (IndexedDB).
-- dm_messages.body now stores base64 ciphertext: iv:ciphertext
-- Limitations: no server search/preview, lost device = lost history, no group E2EE v1.
CREATE TABLE IF NOT EXISTS public.dm_keys (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  public_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.dm_keys ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_keys_public_read ON public.dm_keys FOR
SELECT
  TO authenticated USING (TRUE);


CREATE POLICY dm_keys_own_write ON public.dm_keys FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


CREATE POLICY dm_keys_own_update ON public.dm_keys
FOR UPDATE
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.dm_keys
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
  ON TABLE public.dm_keys TO authenticated;


GRANT INSERT,
UPDATE ON TABLE public.dm_keys TO authenticated;


COMMENT ON TABLE public.dm_keys IS 'E2EE public keys. Private keys live only in device IndexedDB, never sent to server.';


COMMENT ON COLUMN public.dm_messages.body IS 'E2EE ciphertext base64 (iv:ciphertext), NOT plaintext. Server cannot read.';


-- Ciphertext is larger than plaintext (base64 + IV + GCM tag).
-- 2000 chars plaintext ~= 2750 chars ciphertext; allow up to 8000.
ALTER TABLE public.dm_messages
DROP CONSTRAINT IF EXISTS dm_messages_body_length;


ALTER TABLE public.dm_messages
ADD CONSTRAINT dm_messages_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 8000);
