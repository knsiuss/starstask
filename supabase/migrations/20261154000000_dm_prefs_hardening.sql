-- DM prefs + hardening: per-participant pin/mute/archive, pinned messages,
-- race-safe 1-on-1 creation, owner-scoped edit/delete + reaction updates.
-- Additive only; existing rows default to visible/unpinned/unmuted.
ALTER TABLE public.dm_participants
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
ADD COLUMN IF NOT EXISTS archived_at timestamptz;


CREATE INDEX IF NOT EXISTS dm_participants_user_prefs_idx ON public.dm_participants (user_id, is_archived, is_pinned, last_read_at);


ALTER TABLE public.dm_messages
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT FALSE;


CREATE INDEX IF NOT EXISTS dm_messages_conversation_pinned_idx ON public.dm_messages (conversation_id, is_pinned, created_at DESC);


CREATE INDEX IF NOT EXISTS dm_messages_sender_created_idx ON public.dm_messages (sender_id, created_at DESC);


-- Race-safe get-or-create: advisory xact lock on the sorted pair prevents
-- simultaneous inserts from creating duplicate 1-on-1 conversations.
CREATE OR REPLACE FUNCTION public.dm_get_or_create_conversation (p_other uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE v_conv uuid; v_me uuid := auth.uid(); v_lo uuid; v_hi uuid;
BEGIN
  IF v_me IS NULL OR p_other IS NULL OR v_me = p_other THEN RAISE EXCEPTION 'invalid participants' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.dm_blocks WHERE (blocker_id = v_me AND blocked_id = p_other) OR (blocker_id = p_other AND blocked_id = v_me)) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  v_lo := LEAST(v_me, p_other);
  v_hi := GREATEST(v_me, p_other);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lo::text || ':' || v_hi::text, 0));
  SELECT p1.conversation_id INTO v_conv FROM public.dm_participants p1 JOIN public.dm_participants p2 ON p2.conversation_id = p1.conversation_id WHERE p1.user_id = v_me AND p2.user_id = p_other AND p1.left_at IS NULL AND p2.left_at IS NULL LIMIT 1;
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


-- Per-participant preference setters (server-verified membership via RLS
-- on dm_participants + explicit auth.uid() filter).
CREATE OR REPLACE FUNCTION public.dm_set_conversation_pref (
  p_conversation uuid,
  p_pinned boolean DEFAULT NULL,
  p_muted boolean DEFAULT NULL,
  p_archived boolean DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE v_me uuid := auth.uid(); v_rows integer;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.dm_participants SET
    is_pinned = COALESCE(p_pinned, is_pinned),
    pinned_at = CASE WHEN p_pinned IS NULL THEN pinned_at WHEN p_pinned THEN now() ELSE NULL END,
    is_muted = COALESCE(p_muted, is_muted),
    is_archived = COALESCE(p_archived, is_archived),
    archived_at = CASE WHEN p_archived IS NULL THEN archived_at WHEN p_archived THEN now() ELSE NULL END
  WHERE conversation_id = p_conversation AND user_id = v_me AND left_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501'; END IF;
END; $$;


REVOKE ALL ON FUNCTION public.dm_set_conversation_pref (uuid, boolean, boolean, boolean)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.dm_set_conversation_pref (uuid, boolean, boolean, boolean) TO authenticated;


-- Mark unread: reset last_read_at so peer messages count as unread again.
CREATE OR REPLACE FUNCTION public.dm_mark_unread (p_conversation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE v_me uuid := auth.uid(); v_rows integer;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.dm_participants SET last_read_at = NULL
  WHERE conversation_id = p_conversation AND user_id = v_me AND left_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501'; END IF;
END; $$;


REVOKE ALL ON FUNCTION public.dm_mark_unread (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.dm_mark_unread (uuid) TO authenticated;


-- Owner-scoped UPDATE policies: edit/delete own messages, reactions by
-- participants, and own preference columns on dm_participants.
CREATE POLICY dm_participants_own_update ON public.dm_participants
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


CREATE POLICY dm_messages_sender_update ON public.dm_messages
FOR UPDATE
  TO authenticated USING (
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
        AND p.left_at IS NULL
    )
  )
WITH
  CHECK (
    sender_id = (
      SELECT
        auth.uid ()
    )
  );


CREATE POLICY dm_messages_participant_reaction ON public.dm_messages
FOR UPDATE
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
  )
WITH
  CHECK (
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


GRANT
UPDATE ON public.dm_participants TO authenticated;


GRANT
UPDATE ON public.dm_messages TO authenticated;
