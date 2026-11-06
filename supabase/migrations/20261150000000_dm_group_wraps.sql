-- Group DM envelopes (QA-04): per-recipient wrapped data keys stored on the
-- message itself. Every wrap is AEAD ciphertext of a random data key, so the
-- server can store and forward them without ever seeing the data key.
-- Only the intended recipient's private key can unwrap their envelope.

ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS group_wraps jsonb;

CREATE INDEX IF NOT EXISTS dm_messages_group_wraps_idx
  ON public.dm_messages ((group_wraps IS NOT NULL))
  WHERE group_wraps IS NOT NULL;
