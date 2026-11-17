-- E2EE key history (QA-01): retain the previous public key whenever a user
-- changes keys, so clients can pin fingerprints and warn peers on change.
-- History is append-only; the current key stays in dm_keys.
CREATE TABLE IF NOT EXISTS public.dm_key_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  public_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.dm_key_history ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_key_history_own ON public.dm_key_history FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.dm_key_history
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
  ON TABLE public.dm_key_history TO authenticated;
