-- Direct messages (DM bebas, user approved 2026-11-05).
-- Safeguards: participants-only RLS, block list, rate limit via app (max 5/min), max length 2000, soft delete.
-- No group chat in v1 — 1-on-1 only.
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.dm_participants (
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_read_at timestamptz,
  left_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);


CREATE TABLE IF NOT EXISTS public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT dm_messages_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
);


CREATE INDEX IF NOT EXISTS dm_messages_conversation_created_idx ON public.dm_messages (conversation_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.dm_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT dm_blocks_no_self CHECK (blocker_id <> blocked_id)
);


-- 1-on-1 uniqueness helper: one conversation per pair
CREATE OR REPLACE FUNCTION public.dm_get_or_create_conversation (p_other uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE v_conv uuid; v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_other IS NULL OR v_me = p_other THEN RAISE EXCEPTION 'invalid participants' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.dm_blocks WHERE (blocker_id = v_me AND blocked_id = p_other) OR (blocker_id = p_other AND blocked_id = v_me)) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  SELECT p1.conversation_id INTO v_conv FROM public.dm_participants p1 JOIN public.dm_participants p2 ON p2.conversation_id = p1.conversation_id WHERE p1.user_id = v_me AND p2.user_id = p_other LIMIT 1;
  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;
  INSERT INTO public.dm_conversations DEFAULT VALUES RETURNING id INTO v_conv;
  INSERT INTO public.dm_participants (conversation_id, user_id) VALUES (v_conv, v_me), (v_conv, p_other);
  RETURN v_conv;
END; $$;


REVOKE ALL ON FUNCTION public.dm_get_or_create_conversation (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.dm_get_or_create_conversation (uuid) TO authenticated;


ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.dm_blocks ENABLE ROW LEVEL SECURITY;


CREATE POLICY dm_participants_own ON public.dm_participants FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


CREATE POLICY dm_messages_participant_read ON public.dm_messages FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p
      WHERE
        p.conversation_id = dm_messages.conversation_id
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
        AND p.left_at IS NULL
    )
  );


CREATE POLICY dm_messages_participant_insert ON public.dm_messages FOR INSERT TO authenticated
WITH
  CHECK (
    sender_id = (
      SELECT
        auth.uid ()
    )
    AND EXISTS (
      SELECT
        1
      FROM
        public.dm_participants p
      WHERE
        p.conversation_id = dm_messages.conversation_id
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


CREATE POLICY dm_blocks_own ON public.dm_blocks FOR
SELECT
  TO authenticated USING (
    blocker_id = (
      SELECT
        auth.uid ()
    )
    OR blocked_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.dm_conversations,
public.dm_participants,
public.dm_messages,
public.dm_blocks
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
  ON TABLE public.dm_participants,
  public.dm_blocks TO authenticated;


GRANT
SELECT
,
  INSERT ON TABLE public.dm_messages TO authenticated;


GRANT
SELECT
  ON TABLE public.dm_conversations TO authenticated;
