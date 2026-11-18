-- Web Audit Security, RLS/RPC Hardening & Logic Remediation
-- =====================================================================
-- Consolidates fixes for:
--   C-01: Missing column-level SELECT grants (class_members.course_scope, class_invitations.subject_id)
--   C-03 & H-05: Direct Messages RLS lockdown, column grants, block checks, reaction & group RPCs
--   C-04: drive_submissions RLS lockdown (service_role insert, owner revoke-only update)
--   C-05: accept_pending_invitation & decline_class_invitation email_restriction enforcement
--   C-07 & H-07: discussion_session_checkins method CHECK, BAP columns, close_attendance_meeting
--   C-08: Post-20270124 invitation preview/accept RPCs
--   H-01..H-04: course_scope enforcement across policies, content RPCs, attendance, and ketua
--   H-06: sync_offline_attendance_meeting revoke + body hardening
--   H-11: lecturer domain subdomain filter, suspended skip, /lecturer URL, guard_last_class_admin fixes
--   M-01 (DB): export_jobs client INSERT revoke
--   B-05 (DB): auto_cutoff_expired_attendance_meetings default/min cutoff & subject-scoped leave check
-- =====================================================================
-- ---------------------------------------------------------------------------
-- 1. C-01: Missing column-level SELECT grants
-- ---------------------------------------------------------------------------
GRANT
SELECT
  (course_scope) ON public.class_members TO authenticated;


GRANT
SELECT
  (subject_id) ON public.class_invitations TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. C-08 & C-05: Course-scoped invitation preview/accept & token bypass fix
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_preview (p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_hash text;
  v_inv public.class_invitations;
  v_class public.classes;
  v_subject public.class_subjects;
  v_admin_name text;
  v_is_member boolean := false;
  v_is_valid boolean := true;
  v_invalid_reason text := NULL;
  v_user_email text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 20 OR char_length(p_token) > 200 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_token');
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.class_invitations
  WHERE token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_class
  FROM public.classes
  WHERE id = v_inv.class_id;

  IF NOT FOUND OR v_class.status <> 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'class_not_active');
  END IF;

  IF v_inv.subject_id IS NOT NULL THEN
    SELECT * INTO v_subject
    FROM public.class_subjects
    WHERE id = v_inv.subject_id
      AND class_id = v_inv.class_id;
  END IF;

  IF v_user IS NOT NULL THEN
    IF v_inv.subject_id IS NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.class_members
        WHERE class_id = v_inv.class_id
          AND user_id = v_user
      ) INTO v_is_member;
    ELSE
      SELECT (
        EXISTS (
          SELECT 1
          FROM public.class_members
          WHERE class_id = v_inv.class_id
            AND user_id = v_user
            AND course_scope = 'all'
        )
        OR EXISTS (
          SELECT 1
          FROM public.class_member_courses
          WHERE class_id = v_inv.class_id
            AND user_id = v_user
            AND subject_id = v_inv.subject_id
        )
      ) INTO v_is_member;
    END IF;

    IF v_inv.email_restriction IS NOT NULL THEN
      SELECT lower(email) INTO v_user_email
      FROM auth.users
      WHERE id = v_user;

      IF v_user_email IS NULL OR v_user_email <> lower(v_inv.email_restriction) THEN
        v_is_valid := false;
        v_invalid_reason := 'email_mismatch';
      END IF;
    END IF;
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    v_is_valid := false;
    v_invalid_reason := 'revoked';
  ELSIF v_inv.expires_at <= now() THEN
    v_is_valid := false;
    v_invalid_reason := 'expired';
  ELSIF v_inv.used_count >= v_inv.max_uses THEN
    v_is_valid := false;
    v_invalid_reason := 'exhausted';
  END IF;

  SELECT p.display_name INTO v_admin_name
  FROM public.profiles p
  WHERE p.id = v_inv.created_by;

  RETURN jsonb_build_object(
    'valid', v_is_valid,
    'invalid_reason', v_invalid_reason,
    'is_member', v_is_member,
    'class_id', v_class.id,
    'class_name', v_class.name,
    'class_slug', v_class.slug,
    'subject_id', v_subject.id,
    'subject_name', v_subject.name,
    'subject_code', v_subject.code,
    'inviter_name', coalesce(v_admin_name, 'Class Admin'),
    'expires_at', v_inv.expires_at
  );
END;
$$;


REVOKE ALL ON FUNCTION public.get_invitation_preview (text)
FROM
  PUBLIC;


GRANT
EXECUTE ON FUNCTION public.get_invitation_preview (text) TO anon,
authenticated;


CREATE OR REPLACE FUNCTION public.accept_class_invitation (p_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_hash text;
  v_inv public.class_invitations;
  v_email text;
  v_class_status text;
  v_existing_scope text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_token IS NULL OR char_length(p_token) < 20 OR char_length(p_token) > 200 THEN
    RAISE EXCEPTION 'invalid invitation token' USING ERRCODE = '22023';
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.class_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT m.course_scope INTO v_existing_scope
  FROM public.class_members m
  WHERE m.class_id = v_inv.class_id
    AND m.user_id = v_user;

  IF v_inv.subject_id IS NULL THEN
    IF v_existing_scope = 'all' THEN
      RETURN v_inv.class_id;
    END IF;
  ELSE
    IF v_existing_scope = 'all' OR EXISTS (
      SELECT 1
      FROM public.class_member_courses c
      WHERE c.class_id = v_inv.class_id
        AND c.user_id = v_user
        AND c.subject_id = v_inv.subject_id
    ) THEN
      RETURN v_inv.class_id;
    END IF;
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation revoked' USING ERRCODE = '22023';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation expired' USING ERRCODE = '22023';
  END IF;

  IF v_inv.used_count >= v_inv.max_uses THEN
    RAISE EXCEPTION 'invitation already fully used' USING ERRCODE = '22023';
  END IF;

  SELECT c.status INTO v_class_status
  FROM public.classes c
  WHERE c.id = v_inv.class_id;

  IF v_class_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'class is not active' USING ERRCODE = '22023';
  END IF;

  IF v_inv.email_restriction IS NOT NULL THEN
    SELECT lower(u.email) INTO v_email
    FROM auth.users u
    WHERE u.id = v_user;

    IF v_email IS NULL OR v_email <> lower(v_inv.email_restriction) THEN
      RAISE EXCEPTION 'invitation is restricted to another email address' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_inv.subject_id IS NULL THEN
    IF v_existing_scope IS NULL THEN
      INSERT INTO public.class_members (class_id, user_id, joined_via, course_scope)
      VALUES (v_inv.class_id, v_user, 'invitation', 'all');
    ELSE
      UPDATE public.class_members
      SET course_scope = 'all'
      WHERE class_id = v_inv.class_id
        AND user_id = v_user;
    END IF;
  ELSE
    IF v_existing_scope IS NULL THEN
      INSERT INTO public.class_members (class_id, user_id, joined_via, course_scope)
      VALUES (v_inv.class_id, v_user, 'invitation', 'selected');
    END IF;

    INSERT INTO public.class_member_courses (class_id, user_id, subject_id)
    VALUES (v_inv.class_id, v_user, v_inv.subject_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.class_invitation_acceptances (invitation_id, user_id)
  VALUES (v_inv.id, v_user)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    UPDATE public.class_invitations
    SET used_count = used_count + 1
    WHERE id = v_inv.id;
  END IF;

  PERFORM public.record_audit (
    'class_invitation_accepted',
    'class_invitation',
    v_inv.id,
    v_inv.class_id,
    jsonb_build_object('subject_id', v_inv.subject_id)
  );

  RETURN v_inv.class_id;
END;
$$;


REVOKE ALL ON FUNCTION public.accept_class_invitation (text)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.accept_class_invitation (text) TO authenticated;


CREATE OR REPLACE FUNCTION public.accept_pending_invitation (p_invitation_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_inv public.class_invitations;
  v_email text;
  v_class_status text;
  v_existing_scope text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.class_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = v_user;

  IF v_inv.email_restriction IS NULL
     OR v_email IS NULL
     OR v_email <> lower(v_inv.email_restriction) THEN
    RAISE EXCEPTION 'invitation is restricted to another email address' USING ERRCODE = '42501';
  END IF;

  SELECT m.course_scope INTO v_existing_scope
  FROM public.class_members m
  WHERE m.class_id = v_inv.class_id
    AND m.user_id = v_user;

  IF v_inv.subject_id IS NULL THEN
    IF v_existing_scope = 'all' THEN
      RETURN v_inv.class_id;
    END IF;
  ELSE
    IF v_existing_scope = 'all' OR EXISTS (
      SELECT 1
      FROM public.class_member_courses c
      WHERE c.class_id = v_inv.class_id
        AND c.user_id = v_user
        AND c.subject_id = v_inv.subject_id
    ) THEN
      RETURN v_inv.class_id;
    END IF;
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation revoked' USING ERRCODE = '22023';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation expired' USING ERRCODE = '22023';
  END IF;

  IF v_inv.used_count >= v_inv.max_uses THEN
    RAISE EXCEPTION 'invitation already fully used' USING ERRCODE = '22023';
  END IF;

  SELECT c.status INTO v_class_status
  FROM public.classes c
  WHERE c.id = v_inv.class_id;

  IF v_class_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'class is not active' USING ERRCODE = '22023';
  END IF;

  IF v_inv.subject_id IS NULL THEN
    IF v_existing_scope IS NULL THEN
      INSERT INTO public.class_members (class_id, user_id, joined_via, course_scope)
      VALUES (v_inv.class_id, v_user, 'invitation', 'all');
    ELSE
      UPDATE public.class_members
      SET course_scope = 'all'
      WHERE class_id = v_inv.class_id
        AND user_id = v_user;
    END IF;
  ELSE
    IF v_existing_scope IS NULL THEN
      INSERT INTO public.class_members (class_id, user_id, joined_via, course_scope)
      VALUES (v_inv.class_id, v_user, 'invitation', 'selected');
    END IF;

    INSERT INTO public.class_member_courses (class_id, user_id, subject_id)
    VALUES (v_inv.class_id, v_user, v_inv.subject_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.class_invitation_acceptances (invitation_id, user_id)
  VALUES (v_inv.id, v_user)
  ON CONFLICT (invitation_id, user_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.class_invitations
    SET used_count = used_count + 1
    WHERE id = v_inv.id;
  END IF;

  PERFORM public.record_audit (
    'class_invitation_accepted',
    'class_invitation',
    v_inv.id,
    v_inv.class_id,
    jsonb_build_object('subject_id', v_inv.subject_id)
  );

  RETURN v_inv.class_id;
END;
$$;


REVOKE ALL ON FUNCTION public.accept_pending_invitation (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.accept_pending_invitation (uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.decline_class_invitation (p_invitation_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_inv public.class_invitations;
  v_email text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.class_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = v_user;

  IF v_inv.email_restriction IS NULL
     OR v_email IS NULL
     OR v_email <> lower(v_inv.email_restriction) THEN
    RAISE EXCEPTION 'invitation is restricted to another email address' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.class_invitation_declines (invitation_id, user_id)
  VALUES (p_invitation_id, v_user)
  ON CONFLICT (invitation_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;


REVOKE ALL ON FUNCTION public.decline_class_invitation (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.decline_class_invitation (uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. C-03 & H-05: Direct Messages RLS Lockdown + Group & Reaction RPCs
-- ---------------------------------------------------------------------------
REVOKE
UPDATE ON public.dm_participants
FROM
  authenticated;


REVOKE
UPDATE ON public.dm_messages
FROM
  authenticated;


GRANT
UPDATE (
  last_read_at,
  left_at,
  theme,
  last_seen_at,
  is_pinned,
  is_muted,
  is_archived,
  pinned_at,
  archived_at
) ON public.dm_participants TO authenticated;


DROP POLICY IF EXISTS dm_participants_own_update ON public.dm_participants;


CREATE POLICY dm_participants_own_update ON public.dm_participants
FOR UPDATE
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    AND left_at IS NULL
  )
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


CREATE OR REPLACE FUNCTION public.prevent_dm_participant_tampering () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'cannot change participant identity' USING ERRCODE = '42501';
    END IF;

    IF OLD.left_at IS NOT NULL
       AND (NEW.left_at IS NULL OR NEW.left_at IS DISTINCT FROM OLD.left_at) THEN
      RAISE EXCEPTION 'cannot rejoin or alter left_at after leaving' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS dm_participants_immutable_guard ON public.dm_participants;


CREATE TRIGGER dm_participants_immutable_guard
BEFORE UPDATE ON public.dm_participants FOR EACH ROW
EXECUTE FUNCTION public.prevent_dm_participant_tampering ();


DROP POLICY IF EXISTS dm_messages_participant_reaction ON public.dm_messages;


DROP POLICY IF EXISTS dm_messages_sender_update ON public.dm_messages;


GRANT
UPDATE (body, edited_at, deleted_at) ON public.dm_messages TO authenticated;


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
  );


CREATE OR REPLACE FUNCTION public.prevent_dm_message_tampering () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'cannot change immutable message fields' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS dm_messages_immutable_guard ON public.dm_messages;


CREATE TRIGGER dm_messages_immutable_guard
BEFORE UPDATE ON public.dm_messages FOR EACH ROW
EXECUTE FUNCTION public.prevent_dm_message_tampering ();


DROP POLICY IF EXISTS dm_messages_participant_insert ON public.dm_messages;


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
        AND p.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT
        1
      FROM
        public.dm_conversations c
        JOIN public.dm_participants p_other ON p_other.conversation_id = c.id
        AND p_other.user_id <> (
          SELECT
            auth.uid ()
        )
        JOIN public.dm_blocks b ON (
          (
            b.blocker_id = (
              SELECT
                auth.uid ()
            )
            AND b.blocked_id = p_other.user_id
          )
          OR (
            b.blocker_id = p_other.user_id
            AND b.blocked_id = (
              SELECT
                auth.uid ()
            )
          )
        )
      WHERE
        c.id = dm_messages.conversation_id
        AND c.is_group = FALSE
    )
  );


DROP POLICY IF EXISTS dm_typing_participant ON public.dm_typing;


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
      AND p.left_at IS NULL
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
        AND p.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT
        1
      FROM
        public.dm_conversations c
        JOIN public.dm_participants p_other ON p_other.conversation_id = c.id
        AND p_other.user_id <> (
          SELECT
            auth.uid ()
        )
        JOIN public.dm_blocks b ON (
          (
            b.blocker_id = (
              SELECT
                auth.uid ()
            )
            AND b.blocked_id = p_other.user_id
          )
          OR (
            b.blocker_id = p_other.user_id
            AND b.blocked_id = (
              SELECT
                auth.uid ()
            )
          )
        )
      WHERE
        c.id = dm_typing.conversation_id
        AND c.is_group = FALSE
    )
  );


DROP POLICY IF EXISTS dm_calls_participant ON public.dm_calls;


DROP POLICY IF EXISTS dm_calls_participant_select ON public.dm_calls;


CREATE POLICY dm_calls_participant_select ON public.dm_calls FOR
SELECT
  TO authenticated USING (
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
        AND p.left_at IS NULL
    )
  );


DROP POLICY IF EXISTS dm_calls_participant_insert ON public.dm_calls;


CREATE POLICY dm_calls_participant_insert ON public.dm_calls FOR INSERT TO authenticated
WITH
  CHECK (
    caller_id = (
      SELECT
        auth.uid ()
    )
    AND EXISTS (
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
        AND p.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT
        1
      FROM
        public.dm_conversations c
        JOIN public.dm_participants p_other ON p_other.conversation_id = c.id
        AND p_other.user_id <> (
          SELECT
            auth.uid ()
        )
        JOIN public.dm_blocks b ON (
          (
            b.blocker_id = (
              SELECT
                auth.uid ()
            )
            AND b.blocked_id = p_other.user_id
          )
          OR (
            b.blocker_id = p_other.user_id
            AND b.blocked_id = (
              SELECT
                auth.uid ()
            )
          )
        )
      WHERE
        c.id = dm_calls.conversation_id
        AND c.is_group = FALSE
    )
  );


DROP POLICY IF EXISTS dm_calls_participant_update ON public.dm_calls;


CREATE POLICY dm_calls_participant_update ON public.dm_calls
FOR UPDATE
  TO authenticated USING (
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
        p.conversation_id = dm_calls.conversation_id
        AND p.user_id = (
          SELECT
            auth.uid ()
        )
        AND p.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT
        1
      FROM
        public.dm_conversations c
        JOIN public.dm_participants p_other ON p_other.conversation_id = c.id
        AND p_other.user_id <> (
          SELECT
            auth.uid ()
        )
        JOIN public.dm_blocks b ON (
          (
            b.blocker_id = (
              SELECT
                auth.uid ()
            )
            AND b.blocked_id = p_other.user_id
          )
          OR (
            b.blocker_id = p_other.user_id
            AND b.blocked_id = (
              SELECT
                auth.uid ()
            )
          )
        )
      WHERE
        c.id = dm_calls.conversation_id
        AND c.is_group = FALSE
    )
  );


CREATE OR REPLACE FUNCTION public.toggle_dm_message_reaction (p_message_id uuid, p_emoji text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_emoji text := btrim(coalesce(p_emoji, ''));
  v_msg public.dm_messages;
  v_reactions jsonb;
  v_current jsonb;
  v_updated_arr jsonb;
  v_has_user boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_emoji) < 1 OR char_length(v_emoji) > 16 THEN
    RAISE EXCEPTION 'invalid emoji reaction' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_msg
  FROM public.dm_messages m
  WHERE m.id = p_message_id
  FOR UPDATE;

  IF NOT FOUND OR v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants p
    WHERE p.conversation_id = v_msg.conversation_id
      AND p.user_id = v_user
      AND p.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not an active participant' USING ERRCODE = '42501';
  END IF;

  v_reactions := CASE
    WHEN v_msg.reactions IS NOT NULL AND jsonb_typeof(v_msg.reactions) = 'object' THEN v_msg.reactions
    ELSE '{}'::jsonb
  END;

  v_current := v_reactions -> v_emoji;
  IF v_current IS NULL OR jsonb_typeof(v_current) <> 'array' THEN
    v_current := '[]'::jsonb;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_current) AS e
    WHERE e = v_user::text
  ) INTO v_has_user;

  IF v_has_user THEN
    SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
    INTO v_updated_arr
    FROM jsonb_array_elements_text(v_current) AS e
    WHERE e <> v_user::text;

    IF jsonb_array_length(v_updated_arr) = 0 THEN
      v_reactions := v_reactions - v_emoji;
    ELSE
      v_reactions := jsonb_set(v_reactions, ARRAY[v_emoji], v_updated_arr, true);
    END IF;
  ELSE
    v_updated_arr := v_current || to_jsonb(v_user::text);
    v_reactions := jsonb_set(v_reactions, ARRAY[v_emoji], v_updated_arr, true);
  END IF;

  UPDATE public.dm_messages
  SET reactions = v_reactions
  WHERE id = p_message_id;

  RETURN v_reactions;
END;
$$;


REVOKE ALL ON FUNCTION public.toggle_dm_message_reaction (uuid, text)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.toggle_dm_message_reaction (uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.create_group_dm_conversation (p_title text, p_member_ids UUID[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_title text := btrim(coalesce(p_title, ''));
  v_members uuid[];
  v_profile_count integer := 0;
  v_conv_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_title) < 1 OR char_length(v_title) > 100 THEN
    RAISE EXCEPTION 'group title must be 1 to 100 characters' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT m_id), '{}'::uuid[])
  INTO v_members
  FROM unnest(coalesce(p_member_ids, '{}'::uuid[])) AS m_id
  WHERE m_id IS NOT NULL
    AND m_id <> v_user;

  IF coalesce(cardinality(v_members), 0) < 1 OR cardinality(v_members) > 50 THEN
    RAISE EXCEPTION 'group must have 1 to 50 other members' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_profile_count
  FROM public.profiles p
  WHERE p.id = ANY (v_members);

  IF v_profile_count <> cardinality(v_members) THEN
    RAISE EXCEPTION 'one or more members not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dm_blocks b
    WHERE (b.blocker_id = v_user AND b.blocked_id = ANY (v_members))
       OR (b.blocked_id = v_user AND b.blocker_id = ANY (v_members))
  ) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.dm_conversations (is_group, group_name)
  VALUES (true, v_title)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.dm_participants (conversation_id, user_id)
  SELECT v_conv_id, u_id
  FROM unnest(array_prepend(v_user, v_members)) AS u_id
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;


REVOKE ALL ON FUNCTION public.create_group_dm_conversation (text, UUID[])
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.create_group_dm_conversation (text, UUID[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.toggle_dm_message_pin (p_message_id uuid, p_pinned boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_msg public.dm_messages;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_msg
  FROM public.dm_messages m
  WHERE m.id = p_message_id
  FOR UPDATE;

  IF NOT FOUND OR v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants p
    WHERE p.conversation_id = v_msg.conversation_id
      AND p.user_id = v_user
      AND p.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not an active participant' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dm_conversations c
    JOIN public.dm_participants p_other
      ON p_other.conversation_id = c.id
     AND p_other.user_id <> v_user
    JOIN public.dm_blocks b
      ON (b.blocker_id = v_user AND b.blocked_id = p_other.user_id)
      OR (b.blocker_id = p_other.user_id AND b.blocked_id = v_user)
    WHERE c.id = v_msg.conversation_id
      AND c.is_group = false
  ) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;

  UPDATE public.dm_messages
  SET is_pinned = coalesce(p_pinned, false)
  WHERE id = p_message_id;
END;
$$;


REVOKE ALL ON FUNCTION public.toggle_dm_message_pin (uuid, boolean)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.toggle_dm_message_pin (uuid, boolean) TO authenticated;


-- ---------------------------------------------------------------------------
-- 4. C-04: drive_submissions RLS Lockdown
-- ---------------------------------------------------------------------------
REVOKE INSERT,
UPDATE ON public.drive_submissions
FROM
  authenticated;


GRANT
SELECT
,
  DELETE ON public.drive_submissions TO authenticated;


GRANT
UPDATE (share_revoked_at) ON public.drive_submissions TO authenticated;


DROP POLICY IF EXISTS drive_submissions_owner_all ON public.drive_submissions;


DROP POLICY IF EXISTS drive_submissions_owner_select ON public.drive_submissions;


CREATE POLICY drive_submissions_owner_select ON public.drive_submissions FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY IF EXISTS drive_submissions_owner_delete ON public.drive_submissions;


CREATE POLICY drive_submissions_owner_delete ON public.drive_submissions FOR DELETE TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
);


DROP POLICY IF EXISTS drive_submissions_owner_revoke ON public.drive_submissions;


CREATE POLICY drive_submissions_owner_revoke ON public.drive_submissions
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
    AND share_revoked_at IS NOT NULL
  );


-- ---------------------------------------------------------------------------
-- 5. C-07 & H-07: Check-in method CHECK, BAP columns, close_attendance_meeting
-- ---------------------------------------------------------------------------
ALTER TABLE public.discussion_session_checkins
DROP CONSTRAINT IF EXISTS discussion_session_checkins_method_allowed;


ALTER TABLE public.discussion_session_checkins
ADD CONSTRAINT discussion_session_checkins_method_allowed CHECK (method IN ('geo', 'manual', 'system', 'offline_sync'));


ALTER TABLE public.discussion_sessions
ADD COLUMN IF NOT EXISTS bap_topic text NULL CHECK (
  bap_topic IS NULL
  OR char_length(btrim(bap_topic)) <= 300
),
ADD COLUMN IF NOT EXISTS bap_notes text NULL CHECK (
  bap_notes IS NULL
  OR char_length(btrim(bap_notes)) <= 4000
);


GRANT
SELECT
  (bap_topic, bap_notes) ON public.discussion_sessions TO authenticated;


-- ---------------------------------------------------------------------------
-- 6. H-01..H-04: course_scope enforcement & class_subject_members unification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_course_subject (p_class_id uuid, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT
    public.can_manage_class (p_class_id)
    OR EXISTS (
      SELECT
        1
      FROM
        public.class_members m
      WHERE
        m.class_id = p_class_id
        AND m.user_id = (SELECT auth.uid ())
        AND (
          m.course_scope = 'all'
          OR EXISTS (
            SELECT
              1
            FROM
              public.class_member_courses c
            WHERE
              c.class_id = p_class_id
              AND c.user_id = (SELECT auth.uid ())
              AND c.subject_id = p_subject_id
          )
        )
    );
$$;


REVOKE ALL ON FUNCTION public.can_access_course_subject (uuid, uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.can_access_course_subject (uuid, uuid) TO authenticated;


DROP POLICY IF EXISTS class_member_courses_select ON public.class_member_courses;


CREATE POLICY class_member_courses_select ON public.class_member_courses FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_manage_class (class_id)
  );


DROP POLICY IF EXISTS class_member_courses_insert ON public.class_member_courses;


CREATE POLICY class_member_courses_insert ON public.class_member_courses FOR INSERT TO authenticated
WITH
  CHECK (public.can_manage_class (class_id));


DROP POLICY IF EXISTS class_member_courses_delete ON public.class_member_courses;


CREATE POLICY class_member_courses_delete ON public.class_member_courses FOR DELETE TO authenticated USING (public.can_manage_class (class_id));


DROP POLICY IF EXISTS course_comments_update ON public.course_comments;


CREATE POLICY course_comments_update ON public.course_comments
FOR UPDATE
  TO authenticated USING (
    author_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_manage_class (class_id)
  )
WITH
  CHECK (public.can_access_course_subject (class_id, subject_id));


DROP POLICY IF EXISTS course_comments_delete ON public.course_comments;


CREATE POLICY course_comments_delete ON public.course_comments FOR DELETE TO authenticated USING (
  author_id = (
    SELECT
      auth.uid ()
  )
  OR public.can_manage_class (class_id)
);


ALTER TABLE public.course_comments
DROP CONSTRAINT IF EXISTS course_comments_image_path_scope;


ALTER TABLE public.course_comments
ADD CONSTRAINT course_comments_image_path_scope CHECK (
  image_path IS NULL
  OR (
    image_path LIKE (class_id::text || '/' || subject_id::text || '/comments/%')
    AND position('..' IN image_path) = 0
  )
) NOT VALID;


CREATE OR REPLACE FUNCTION public.ensure_course_comment_parent_scope () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.course_comments parent
      WHERE parent.id = NEW.parent_id
        AND parent.class_id = NEW.class_id
        AND parent.subject_id = NEW.subject_id
    ) THEN
      RAISE EXCEPTION 'parent comment must belong to the same class and course' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS course_comments_parent_scope_trg ON public.course_comments;


CREATE TRIGGER course_comments_parent_scope_trg
BEFORE INSERT OR UPDATE OF parent_id,
class_id,
subject_id ON public.course_comments FOR EACH ROW
EXECUTE FUNCTION public.ensure_course_comment_parent_scope ();


DROP POLICY IF EXISTS course_materials_member_read ON public.course_materials;


CREATE POLICY course_materials_member_read ON public.course_materials FOR
SELECT
  TO authenticated USING (public.can_access_course_subject (class_id, subject_id));


DROP POLICY IF EXISTS assignments_authenticated_read ON public.assignments;


CREATE POLICY assignments_authenticated_read ON public.assignments FOR
SELECT
  TO authenticated USING (
    (
      (
        SELECT
          auth.uid ()
      ) = user_id
    )
    OR (
      class_id IS NOT NULL
      AND (
        (
          SELECT
            is_class_admin (class_id)
        )
        OR (
          SELECT
            is_platform_admin ()
        )
      )
    )
    OR (
      status = 'published'::text
      AND class_id IS NOT NULL
      AND (
        SELECT
          is_class_member (class_id)
      )
      AND (
        subject_id IS NULL
        OR public.can_access_course_subject (class_id, subject_id)
      )
    )
    OR (
      class_id IS NULL
      AND (
        SELECT
          is_platform_admin ()
      )
    )
    OR (
      status = 'published'::text
      AND class_id IS NULL
    )
  );


DROP POLICY IF EXISTS assignment_attachments_read ON public.assignment_attachments;


CREATE POLICY assignment_attachments_read ON public.assignment_attachments FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_attachments.assignment_id
        AND (
          (
            a.status = 'published'::text
            AND (
              a.class_id IS NULL
              OR (
                (
                  SELECT
                    public.is_class_member (a.class_id)
                )
                AND (
                  a.subject_id IS NULL
                  OR public.can_access_course_subject (a.class_id, a.subject_id)
                )
              )
            )
          )
          OR a.user_id = (
            SELECT
              auth.uid ()
          )
          OR (
            SELECT
              is_platform_admin ()
          )
          OR (
            a.class_id IS NOT NULL
            AND (
              SELECT
                is_class_admin (a.class_id)
            )
          )
        )
    )
  );


CREATE OR REPLACE FUNCTION public.submit_class_assignment (
  p_class_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz DEFAULT NULL,
  p_assignment_type text DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_reference_urls jsonb DEFAULT '[]'::jsonb,
  p_content_type text DEFAULT 'lecturer_assignment',
  p_source_label text DEFAULT NULL,
  p_drive_url text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_class public.classes;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_class
  FROM public.classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_class.status <> 'active' THEN
    RAISE EXCEPTION 'class is not accepting submissions' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_class_member (p_class_id) THEN
    RAISE EXCEPTION 'class membership required' USING ERRCODE = '42501';
  END IF;

  IF p_content_type = 'class_announcement'
     AND NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'class admin required for announcements' USING ERRCODE = '42501';
  END IF;

  IF p_content_type NOT IN ('lecturer_assignment', 'class_announcement') THEN
    RAISE EXCEPTION 'unknown content type' USING ERRCODE = '22023';
  END IF;

  IF p_subject_id IS NULL THEN
    RAISE EXCEPTION 'a course is required for class content' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_subjects cs
    WHERE cs.id = p_subject_id
      AND cs.class_id = p_class_id
  ) THEN
    RAISE EXCEPTION 'subject does not belong to this class' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_access_course_subject (p_class_id, p_subject_id) THEN
    RAISE EXCEPTION 'not enrolled in this course' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.assignments (
    title,
    description,
    course_id,
    user_id,
    class_id,
    subject_id,
    lecturer_name,
    semester,
    academic_year,
    assignment_type,
    content_type,
    source_label,
    drive_url,
    deadline,
    tags,
    reference_urls,
    status
  )
  VALUES (
    btrim(p_title),
    btrim(p_description),
    v_class.course_id,
    v_user,
    p_class_id,
    p_subject_id,
    v_class.lecturer_name,
    v_class.semester,
    v_class.academic_year,
    p_assignment_type,
    p_content_type,
    nullif(btrim(coalesce(p_source_label, '')), ''),
    p_drive_url,
    p_deadline,
    coalesce(p_tags, '{}'),
    coalesce(p_reference_urls, '[]'::jsonb),
    'pending_review'
  )
  RETURNING id INTO v_id;

  INSERT INTO public.assignment_reviews (assignment_id, reviewer_id, decision)
  VALUES (v_id, v_user, 'submitted');

  PERFORM public.record_audit (
    'assignment_submitted',
    'assignment',
    v_id,
    p_class_id,
    jsonb_build_object(
      'content_type', p_content_type,
      'subject_id', p_subject_id,
      'revision', 1
    )
  );

  RETURN v_id;
END;
$$;


REVOKE ALL ON FUNCTION public.submit_class_assignment (
  uuid,
  text,
  text,
  timestamptz,
  text,
  TEXT[],
  jsonb,
  text,
  text,
  text,
  uuid
)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.submit_class_assignment (
  uuid,
  text,
  text,
  timestamptz,
  text,
  TEXT[],
  jsonb,
  text,
  text,
  text,
  uuid
) TO authenticated;


CREATE OR REPLACE FUNCTION public.list_course_component_grades (p_class_id uuid, p_subject_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid ());
  v_can_manage boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    IF current_user IN ('postgres', 'service_role') THEN
      v_can_manage := true;
    ELSE
      RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_can_manage := public.can_manage_class (p_class_id);

    IF NOT v_can_manage AND NOT public.can_access_course_subject (p_class_id, p_subject_id) THEN
      RAISE EXCEPTION 'not enrolled in this course' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_object_agg(
        g.student_id::text || ':' || g.component,
        g.score
      )
      FROM public.course_component_grades g
      WHERE g.class_id = p_class_id
        AND g.subject_id = p_subject_id
        AND (
          v_can_manage
          OR g.student_id = v_user_id
        )
    ),
    '{}'::jsonb
  );
END;
$$;


REVOKE ALL ON FUNCTION public.list_course_component_grades (uuid, uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.list_course_component_grades (uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.set_leave_request_subjects (p_request_id uuid, p_subject_ids UUID[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_ids uuid[] := coalesce(p_subject_ids, '{}'::uuid[]);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM public.leave_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_request.student_id <> v_user_id THEN
    RAISE EXCEPTION 'only the owner may change the covered courses' USING ERRCODE = '42501';
  END IF;

  IF v_request.status NOT IN ('draft', 'revision_requested') THEN
    RAISE EXCEPTION 'this request can no longer be edited' USING ERRCODE = 'SS011';
  END IF;

  IF coalesce(array_length(v_ids, 1), 0) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(v_ids) AS sid
      WHERE sid IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM public.class_subjects cs
           WHERE cs.id = sid
             AND cs.class_id = v_request.class_id
         )
         OR NOT public.can_access_course_subject (v_request.class_id, sid)
    ) THEN
      RAISE EXCEPTION 'one or more subjects are not accessible in this class' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.leave_requests r
  SET subject_ids = v_ids
  WHERE r.id = p_request_id;
END;
$$;


REVOKE ALL ON FUNCTION public.set_leave_request_subjects (uuid, UUID[])
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_dashboard_overview (p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_tz text;
  v_now timestamptz := now();
  v_due_start timestamptz;
  v_due_end timestamptz;
  v_new_since timestamptz;
  v_result jsonb;
BEGIN
  IF p_user_id IS DISTINCT FROM (SELECT auth.uid ())
     AND NOT public.is_platform_admin () THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT timezone INTO v_tz
  FROM public.notification_preferences
  WHERE user_id = p_user_id;

  IF v_tz IS NULL
     OR v_tz NOT IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC') THEN
    v_tz := NULL;
  END IF;

  v_due_start := ((v_now AT TIME ZONE 'Asia/Jakarta')::date)::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_due_end := v_due_start + interval '7 days';
  v_new_since := v_now - interval '7 days';

  SELECT
    jsonb_build_object(
      'classes',
      coalesce(classes_json, '[]'::jsonb),
      'stats',
      jsonb_build_object(
        'totalTasks', coalesce(stats_json ->> 'totalTasks', '0')::int,
        'dueSoon', coalesce(stats_json ->> 'dueSoon', '0')::int,
        'pastDeadline', coalesce(stats_json ->> 'pastDeadline', '0')::int,
        'classCount', coalesce(jsonb_array_length(classes_json), 0),
        'newThisWeek', coalesce(stats_json ->> 'newThisWeek', '0')::int
      ),
      'recentTasks',
      coalesce(recent_json, '[]'::jsonb),
      'timeZone',
      v_tz,
      'nowIso',
      v_now
    )
  INTO v_result
  FROM (
    SELECT
      (
        SELECT jsonb_agg(row_to_json(t) ORDER BY t.name)
        FROM (
          SELECT
            cl.id,
            cl.slug,
            cl.name,
            cl.course_name,
            cl.semester,
            cl.academic_year,
            (
              SELECT count(*)
              FROM public.assignments a
              WHERE a.class_id = cl.id
                AND a.status = 'published'
                AND (
                  a.subject_id IS NULL
                  OR m.course_scope = 'all'
                  OR EXISTS (
                    SELECT 1
                    FROM public.class_member_courses cmc
                    WHERE cmc.class_id = cl.id
                      AND cmc.user_id = p_user_id
                      AND cmc.subject_id = a.subject_id
                  )
                )
            ) + (
              SELECT count(*)
              FROM public.assignments a
              JOIN public.class_subjects cs
                ON cs.class_id = cl.id
               AND cs.course_id = a.course_id
              WHERE a.class_id IS NULL
                AND a.subject_id IS NULL
                AND a.status = 'published'
                AND (
                  m.course_scope = 'all'
                  OR EXISTS (
                    SELECT 1
                    FROM public.class_member_courses cmc
                    WHERE cmc.class_id = cl.id
                      AND cmc.user_id = p_user_id
                      AND cmc.subject_id = cs.id
                  )
                )
            ) AS task_count,
            EXISTS (
              SELECT 1
              FROM public.class_admins ca
              WHERE ca.class_id = cl.id
                AND ca.user_id = p_user_id
            ) AS is_admin,
            (
              SELECT count(*)
              FROM public.class_subjects cs
              WHERE cs.class_id = cl.id
                AND (
                  m.course_scope = 'all'
                  OR EXISTS (
                    SELECT 1
                    FROM public.class_member_courses cmc
                    WHERE cmc.class_id = cl.id
                      AND cmc.user_id = p_user_id
                      AND cmc.subject_id = cs.id
                  )
                )
            ) AS subject_count,
            NULL::text AS admin_name
          FROM public.classes cl
          JOIN public.class_members m
            ON m.class_id = cl.id
           AND m.user_id = p_user_id
          WHERE cl.status = 'active'
        ) t
      ) AS classes_json,
      (
        SELECT jsonb_build_object(
          'totalTasks',
          (
            SELECT count(DISTINCT a.id)
            FROM public.assignments a
            WHERE a.status = 'published'
              AND (
                EXISTS (
                  SELECT 1
                  FROM public.class_members m
                  JOIN public.classes cl ON cl.id = m.class_id
                  WHERE m.user_id = p_user_id
                    AND cl.status = 'active'
                    AND a.class_id = cl.id
                    AND (
                      a.subject_id IS NULL
                      OR m.course_scope = 'all'
                      OR EXISTS (
                        SELECT 1
                        FROM public.class_member_courses cmc
                        WHERE cmc.class_id = cl.id
                          AND cmc.user_id = p_user_id
                          AND cmc.subject_id = a.subject_id
                      )
                    )
                )
                OR (
                  a.class_id IS NULL
                  AND a.subject_id IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM public.class_members m
                    JOIN public.classes cl ON cl.id = m.class_id
                    JOIN public.class_subjects cs ON cs.class_id = cl.id
                    WHERE m.user_id = p_user_id
                      AND cl.status = 'active'
                      AND cs.course_id = a.course_id
                      AND (
                        m.course_scope = 'all'
                        OR EXISTS (
                          SELECT 1
                          FROM public.class_member_courses cmc
                          WHERE cmc.class_id = cl.id
                            AND cmc.user_id = p_user_id
                            AND cmc.subject_id = cs.id
                        )
                      )
                  )
                )
              )
          ),
          'dueSoon',
          (
            SELECT count(*)
            FROM public.assignments a
            JOIN public.class_members m
              ON m.class_id = a.class_id
             AND m.user_id = p_user_id
            WHERE a.status = 'published'
              AND a.deadline >= v_due_start
              AND a.deadline < v_due_end
              AND (
                a.subject_id IS NULL
                OR m.course_scope = 'all'
                OR EXISTS (
                  SELECT 1
                  FROM public.class_member_courses cmc
                  WHERE cmc.class_id = a.class_id
                    AND cmc.user_id = p_user_id
                    AND cmc.subject_id = a.subject_id
                )
              )
          ),
          'pastDeadline',
          (
            SELECT count(*)
            FROM public.assignments a
            JOIN public.class_members m
              ON m.class_id = a.class_id
             AND m.user_id = p_user_id
            WHERE a.status = 'published'
              AND a.deadline < v_due_start
              AND (
                a.subject_id IS NULL
                OR m.course_scope = 'all'
                OR EXISTS (
                  SELECT 1
                  FROM public.class_member_courses cmc
                  WHERE cmc.class_id = a.class_id
                    AND cmc.user_id = p_user_id
                    AND cmc.subject_id = a.subject_id
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM public.assignment_completions ac
                WHERE ac.assignment_id = a.id
                  AND ac.user_id = p_user_id
              )
          ),
          'newThisWeek',
          (
            SELECT count(*)
            FROM public.assignments a
            JOIN public.class_members m
              ON m.class_id = a.class_id
             AND m.user_id = p_user_id
            WHERE a.status = 'published'
              AND a.published_at >= v_new_since
              AND (
                a.subject_id IS NULL
                OR m.course_scope = 'all'
                OR EXISTS (
                  SELECT 1
                  FROM public.class_member_courses cmc
                  WHERE cmc.class_id = a.class_id
                    AND cmc.user_id = p_user_id
                    AND cmc.subject_id = a.subject_id
                )
              )
          )
        )
      ) AS stats_json,
      (
        SELECT jsonb_agg(row_to_json(r) ORDER BY r.published_at DESC)
        FROM (
          SELECT
            a.id,
            a.title,
            a.deadline,
            cl.name AS class_name,
            a.published_at
          FROM public.assignments a
          JOIN public.classes cl ON cl.id = a.class_id
          JOIN public.class_members m
            ON m.class_id = cl.id
           AND m.user_id = p_user_id
          WHERE a.status = 'published'
            AND (
              a.subject_id IS NULL
              OR m.course_scope = 'all'
              OR EXISTS (
                SELECT 1
                FROM public.class_member_courses cmc
                WHERE cmc.class_id = cl.id
                  AND cmc.user_id = p_user_id
                  AND cmc.subject_id = a.subject_id
              )
            )
          ORDER BY a.published_at DESC NULLS LAST
          LIMIT 5
        ) r
      ) AS recent_json
  ) s;

  RETURN v_result;
END;
$$;


REVOKE ALL ON FUNCTION public.get_dashboard_overview (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.get_dashboard_overview (uuid) TO authenticated;


-- H-03: Unify class_subject_members with course_scope & class_member_courses
CREATE OR REPLACE FUNCTION public.enroll_members_on_class_join () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NEW.course_scope <> 'all' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
  SELECT
    NEW.class_id,
    s.id,
    NEW.user_id,
    CASE NEW.joined_via
      WHEN 'invitation' THEN 'invitation'
      WHEN 'admin_assignment' THEN 'admin_assignment'
      WHEN 'platform_assignment' THEN 'platform_assignment'
      ELSE 'manual'
    END,
    now()
  FROM public.class_subjects s
  WHERE s.class_id = NEW.class_id
    AND s.status = 'active'
  ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.enroll_members_on_subject_create () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
  SELECT NEW.class_id, NEW.id, m.user_id, 'backfill', now()
  FROM public.class_members m
  WHERE m.class_id = NEW.class_id
    AND m.course_scope = 'all'
  ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.sync_subject_members_on_scope_upgrade () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF OLD.course_scope <> 'all' AND NEW.course_scope = 'all' THEN
    INSERT INTO public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
    SELECT NEW.class_id, s.id, NEW.user_id, 'invitation', now()
    FROM public.class_subjects s
    WHERE s.class_id = NEW.class_id
      AND s.status = 'active'
    ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


REVOKE ALL ON FUNCTION public.sync_subject_members_on_scope_upgrade ()
FROM
  PUBLIC,
  anon,
  authenticated;


DROP TRIGGER IF EXISTS class_members_sync_scope_upgrade ON public.class_members;


CREATE TRIGGER class_members_sync_scope_upgrade
AFTER UPDATE OF course_scope ON public.class_members FOR EACH ROW
EXECUTE FUNCTION public.sync_subject_members_on_scope_upgrade ();


CREATE OR REPLACE FUNCTION public.sync_subject_members_on_member_course () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
    VALUES (NEW.class_id, NEW.subject_id, NEW.user_id, 'invitation', now())
    ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.class_subject_members csm
    WHERE csm.class_id = OLD.class_id
      AND csm.subject_id = OLD.subject_id
      AND csm.user_id = OLD.user_id
      AND EXISTS (
        SELECT 1
        FROM public.class_members m
        WHERE m.class_id = OLD.class_id
          AND m.user_id = OLD.user_id
          AND m.course_scope = 'selected'
      );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


REVOKE ALL ON FUNCTION public.sync_subject_members_on_member_course ()
FROM
  PUBLIC,
  anon,
  authenticated;


DROP TRIGGER IF EXISTS class_member_courses_sync_subject_members ON public.class_member_courses;


CREATE TRIGGER class_member_courses_sync_subject_members
AFTER INSERT OR DELETE ON public.class_member_courses FOR EACH ROW
EXECUTE FUNCTION public.sync_subject_members_on_member_course ();


-- Reconcile any pre-existing course_scope = 'selected' rows in class_subject_members
DELETE FROM public.class_subject_members csm USING public.class_members m
WHERE
  m.class_id = csm.class_id
  AND m.user_id = csm.user_id
  AND m.course_scope = 'selected'
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.class_member_courses cmc
    WHERE
      cmc.class_id = csm.class_id
      AND cmc.user_id = csm.user_id
      AND cmc.subject_id = csm.subject_id
  );


INSERT INTO
  public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
SELECT
  cmc.class_id,
  cmc.subject_id,
  cmc.user_id,
  'invitation',
  now()
FROM
  public.class_member_courses cmc
  JOIN public.class_members m ON m.class_id = cmc.class_id
  AND m.user_id = cmc.user_id
ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;


DROP FUNCTION IF EXISTS public.close_attendance_meeting (uuid, boolean);


CREATE OR REPLACE FUNCTION public.close_attendance_meeting (
  p_session_id uuid,
  p_finalize boolean DEFAULT FALSE,
  p_bap_topic text DEFAULT NULL,
  p_bap_notes text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_session public.discussion_sessions %ROWTYPE;
  v_inserted integer := 0;
  v_topic text := nullif(btrim(coalesce(p_bap_topic, '')), '');
  v_notes text := nullif(btrim(coalesce(p_bap_notes, '')), '');
BEGIN
  IF v_topic IS NOT NULL AND char_length(v_topic) > 300 THEN
    RAISE EXCEPTION 'BAP topic must be 300 characters or fewer' USING ERRCODE = '22023';
  END IF;

  IF v_notes IS NOT NULL AND char_length(v_notes) > 4000 THEN
    RAISE EXCEPTION 'BAP notes must be 4000 characters or fewer' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.discussion_sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_organize_class_sessions (v_session.class_id) THEN
    RAISE EXCEPTION 'Not allowed to close attendance for this meeting' USING ERRCODE = '42501';
  END IF;

  IF v_session.meeting_number IS NULL THEN
    RAISE EXCEPTION 'This session is not an attendance meeting' USING ERRCODE = '22023';
  END IF;

  IF v_session.attendance_opened_at IS NULL THEN
    RAISE EXCEPTION 'Attendance has not been opened' USING ERRCODE = '22023';
  END IF;

  IF v_session.attendance_finalized_at IS NOT NULL THEN
    IF v_topic IS NOT NULL OR v_notes IS NOT NULL THEN
      UPDATE public.discussion_sessions
      SET
        bap_topic = coalesce(v_topic, bap_topic),
        bap_notes = coalesce(v_notes, bap_notes),
        updated_at = now()
      WHERE id = p_session_id;
    END IF;

    RETURN 0;
  END IF;

  IF p_finalize THEN
    INSERT INTO public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      note,
      reviewed_by,
      reviewed_at
    )
    SELECT
      p_session_id,
      m.user_id,
      'absent',
      'system',
      'Finalized without a check-in',
      auth.uid (),
      now()
    FROM public.class_members m
    WHERE m.class_id = v_session.class_id
      AND m.joined_at <= v_session.starts_at
      AND (
        v_session.subject_id IS NULL
        OR (
          (
            m.course_scope = 'all'
            OR EXISTS (
              SELECT 1
              FROM public.class_member_courses cmc
              WHERE cmc.class_id = v_session.class_id
                AND cmc.user_id = m.user_id
                AND cmc.subject_id = v_session.subject_id
            )
          )
          AND EXISTS (
            SELECT 1
            FROM public.class_subject_members em
            WHERE em.class_id = v_session.class_id
              AND em.subject_id = v_session.subject_id
              AND em.user_id = m.user_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.discussion_session_checkins c
        WHERE c.session_id = p_session_id
          AND c.user_id = m.user_id
      )
    ON CONFLICT (session_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  UPDATE public.discussion_sessions
  SET
    attendance_closed_at = coalesce(attendance_closed_at, now()),
    attendance_finalized_at = CASE
      WHEN p_finalize THEN coalesce(attendance_finalized_at, now())
      ELSE attendance_finalized_at
    END,
    bap_topic = coalesce(v_topic, bap_topic),
    bap_notes = coalesce(v_notes, bap_notes),
    updated_at = now()
  WHERE id = p_session_id;

  PERFORM public.record_audit (
    CASE
      WHEN p_finalize THEN 'attendance_meeting_finalized'
      ELSE 'attendance_meeting_closed'
    END,
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object(
      'absent_created', v_inserted,
      'has_bap', (v_topic IS NOT NULL OR v_notes IS NOT NULL)
    )
  );

  RETURN v_inserted;
END;
$$;


REVOKE ALL ON FUNCTION public.close_attendance_meeting (uuid, boolean, text, text)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.close_attendance_meeting (uuid, boolean, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.check_in_attendance_meeting (
  p_session_id uuid,
  p_full_name text,
  p_nim text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_session public.discussion_sessions %ROWTYPE;
  v_profile public.profiles %ROWTYPE;
  v_checkin public.discussion_session_checkins %ROWTYPE;
  v_distance double precision;
  v_new_status text;
  v_checkin_id uuid;
  v_joined_at timestamptz;
  v_course_scope text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to check in' USING ERRCODE = '42501';
  END IF;

  IF p_latitude IS NULL
     OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Invalid coordinates' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.discussion_sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_class_member (v_session.class_id) THEN
    RAISE EXCEPTION 'Only class members can check in' USING ERRCODE = '42501';
  END IF;

  SELECT m.joined_at, m.course_scope
  INTO v_joined_at, v_course_scope
  FROM public.class_members m
  WHERE m.class_id = v_session.class_id
    AND m.user_id = v_user_id;

  IF v_session.subject_id IS NOT NULL
     AND (
       (
         v_course_scope <> 'all'
         AND NOT EXISTS (
           SELECT 1
           FROM public.class_member_courses cmc
           WHERE cmc.class_id = v_session.class_id
             AND cmc.user_id = v_user_id
             AND cmc.subject_id = v_session.subject_id
         )
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.class_subject_members em
         WHERE em.class_id = v_session.class_id
           AND em.subject_id = v_session.subject_id
           AND em.user_id = v_user_id
       )
     ) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'You are not enrolled in this course, so this meeting is not part of your attendance.'
    );
  END IF;

  IF v_joined_at IS NULL
     OR v_joined_at > v_session.starts_at THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'You joined this class after the meeting started, so this meeting is not part of your attendance.'
    );
  END IF;

  IF v_session.meeting_number IS NULL THEN
    RAISE EXCEPTION 'This session is not an attendance meeting' USING ERRCODE = '22023';
  END IF;

  IF v_session.status <> 'scheduled' THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'This meeting is not open for check-in.'
    );
  END IF;

  IF v_session.attendance_opened_at IS NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_open');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_not_open',
      'message', 'Attendance has not been opened for this meeting.'
    );
  END IF;

  IF v_session.attendance_closed_at IS NOT NULL
     OR v_session.attendance_finalized_at IS NOT NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'Attendance for this meeting has closed.'
    );
  END IF;

  IF now() > coalesce(v_session.attendance_closes_at, v_session.ends_at) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'The attendance window has ended.'
    );
  END IF;

  IF v_session.checkin_latitude IS NULL
     OR v_session.checkin_longitude IS NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'This meeting has no attendance location configured.'
    );
  END IF;

  IF p_accuracy_m IS NULL
     OR p_accuracy_m < 0
     OR p_accuracy_m > 100 THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'imprecise', NULL, p_accuracy_m);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_imprecise',
      'message', 'Your location reading is not accurate enough. Move somewhere with a clearer signal and try again.',
      'accuracyM', p_accuracy_m,
      'maxAccuracyM', 100
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF NOT FOUND
     OR public.attendance_normalize_identity (v_profile.full_name) = ''
     OR public.attendance_normalize_identity (v_profile.nim) = '' THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'identity_missing');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_identity_missing',
      'message', 'Add your full name and NIM in your profile before checking in.'
    );
  END IF;

  IF public.attendance_normalize_identity (p_full_name) <> public.attendance_normalize_identity (v_profile.full_name) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'name_mismatch');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_name_mismatch',
      'message', 'The name you entered does not match your verified profile. Correct it in your profile, then try again.'
    );
  END IF;

  IF public.attendance_normalize_identity (p_nim) <> public.attendance_normalize_identity (v_profile.nim) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'nim_mismatch');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_nim_mismatch',
      'message', 'The NIM you entered does not match your verified profile. Correct it in your profile, then try again.'
    );
  END IF;

  v_distance := public.distance_meters (
    p_latitude,
    p_longitude,
    v_session.checkin_latitude,
    v_session.checkin_longitude
  );

  IF v_distance > v_session.checkin_radius_m THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'outside_radius', v_distance, p_accuracy_m);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_too_far',
      'message', 'Please go to your class meeting point and try again.'
    );
  END IF;

  SELECT * INTO v_checkin
  FROM public.discussion_session_checkins c
  WHERE c.session_id = p_session_id
    AND c.user_id = v_user_id;

  IF FOUND
     AND v_checkin.method IN ('manual', 'system')
     AND v_checkin.reviewed_at IS NOT NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'already_checked_in', v_checkin.distance_m, v_checkin.accuracy_m);
    RETURN jsonb_build_object(
      'ok', true,
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  END IF;

  v_new_status := 'present';

  IF v_checkin.id IS NOT NULL THEN
    UPDATE public.discussion_session_checkins
    SET
      status = v_new_status,
      method = 'geo',
      latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = p_accuracy_m,
      distance_m = v_distance,
      checked_in_at = now(),
      note = NULL,
      identity_verified = true,
      identity_verified_at = now(),
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now()
    WHERE id = v_checkin.id
    RETURNING id INTO v_checkin_id;
  ELSE
    INSERT INTO public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      latitude,
      longitude,
      accuracy_m,
      distance_m,
      identity_verified,
      identity_verified_at
    )
    VALUES (
      p_session_id,
      v_user_id,
      v_new_status,
      'geo',
      p_latitude,
      p_longitude,
      p_accuracy_m,
      v_distance,
      true,
      now()
    )
    ON CONFLICT (session_id, user_id) DO NOTHING
    RETURNING id INTO v_checkin_id;
  END IF;

  IF v_checkin_id IS NULL THEN
    SELECT * INTO v_checkin
    FROM public.discussion_session_checkins c
    WHERE c.session_id = p_session_id
      AND c.user_id = v_user_id;

    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'already_checked_in', v_checkin.distance_m, v_checkin.accuracy_m);

    RETURN jsonb_build_object(
      'ok', true,
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  END IF;

  PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'checked_in', v_distance, p_accuracy_m);

  PERFORM public.record_audit (
    'attendance_meeting_checked_in',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object('status', v_new_status, 'distance_m', round(v_distance))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_checkin_id,
    'status', v_new_status,
    'checked_in_at', now(),
    'distance_m', v_distance,
    'accuracy_m', p_accuracy_m,
    'already_checked_in', false
  );
END;
$$;


REVOKE ALL ON FUNCTION public.check_in_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision
)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.check_in_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision
) TO authenticated;


CREATE OR REPLACE FUNCTION public.attendance_meeting_roster (p_session_id uuid) RETURNS TABLE (
  user_id uuid,
  full_name text,
  nim text,
  display_name text,
  joined_at timestamptz,
  eligible boolean,
  status text,
  method text,
  checked_in_at timestamptz,
  distance_m double precision,
  accuracy_m double precision,
  note text,
  reviewed_at timestamptz,
  identity_verified boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_class_id uuid;
  v_subject_id uuid;
  v_starts_at timestamptz;
  v_finalized boolean;
BEGIN
  SELECT s.class_id, s.subject_id, s.starts_at, s.attendance_finalized_at IS NOT NULL
  INTO v_class_id, v_subject_id, v_starts_at, v_finalized
  FROM public.discussion_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_organize_class_sessions (v_class_id) THEN
    RAISE EXCEPTION 'Not allowed to view this attendance roster' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member') AS full_name,
    p.nim,
    p.display_name,
    m.joined_at,
    m.joined_at <= v_starts_at AS eligible,
    CASE
      WHEN m.joined_at > v_starts_at THEN 'not_applicable'
      WHEN c.id IS NOT NULL THEN c.status
      WHEN v_finalized THEN 'absent'
      ELSE 'not_recorded'
    END AS status,
    c.method,
    c.checked_in_at,
    c.distance_m,
    c.accuracy_m,
    c.note,
    c.reviewed_at,
    coalesce(c.identity_verified, FALSE) AS identity_verified
  FROM public.class_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.class_subject_members em
    ON em.class_id = m.class_id
   AND em.user_id = m.user_id
   AND em.subject_id = v_subject_id
  LEFT JOIN public.discussion_session_checkins c
    ON c.session_id = p_session_id
   AND c.user_id = m.user_id
  WHERE m.class_id = v_class_id
    AND (
      v_subject_id IS NULL
      OR (
        em.user_id IS NOT NULL
        AND (
          m.course_scope = 'all'
          OR EXISTS (
            SELECT 1
            FROM public.class_member_courses cmc
            WHERE cmc.class_id = m.class_id
              AND cmc.user_id = m.user_id
              AND cmc.subject_id = v_subject_id
          )
        )
      )
    )
  ORDER BY
    lower(coalesce(nullif(btrim(p.full_name), ''), p.display_name, 'Member')) ASC,
    p.nim ASC NULLS LAST,
    m.user_id ASC;
END;
$$;


REVOKE ALL ON FUNCTION public.attendance_meeting_roster (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.attendance_meeting_roster (uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.class_attendance_meeting_list (p_class_id uuid) RETURNS TABLE (
  session_id uuid,
  subject_id uuid,
  subject_name text,
  subject_code text,
  meeting_number integer,
  meeting_date date,
  title text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  attendance_opens_at timestamptz,
  attendance_closes_at timestamptz,
  attendance_opened_at timestamptz,
  attendance_closed_at timestamptz,
  attendance_finalized_at timestamptz,
  radius_m integer,
  late_after_minutes integer,
  expected_count integer,
  present_count integer,
  late_count integer,
  excused_count integer,
  sick_count integer,
  absent_count integer,
  not_recorded_count integer,
  failed_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'Not allowed to view attendance meetings' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.subject_id,
    sub.name,
    sub.code,
    s.meeting_number,
    s.meeting_date,
    s.title,
    s.location,
    s.starts_at,
    s.ends_at,
    s.attendance_opens_at,
    s.attendance_closes_at,
    s.attendance_opened_at,
    s.attendance_closed_at,
    s.attendance_finalized_at,
    s.checkin_radius_m,
    s.late_after_minutes,
    coalesce(t.expected, 0)::integer,
    coalesce(t.present_count, 0)::integer,
    coalesce(t.late_count, 0)::integer,
    coalesce(t.excused_count, 0)::integer,
    coalesce(t.sick_count, 0)::integer,
    coalesce(t.absent_count, 0)::integer,
    greatest(
      coalesce(t.expected, 0)
      - coalesce(t.present_count, 0)
      - coalesce(t.late_count, 0)
      - coalesce(t.excused_count, 0)
      - coalesce(t.sick_count, 0)
      - coalesce(t.absent_count, 0),
      0
    )::integer,
    coalesce(f.failed_count, 0)::integer
  FROM public.discussion_sessions s
  JOIN public.class_subjects sub ON sub.id = s.subject_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) AS expected,
      count(*) FILTER (WHERE c.status = 'present') AS present_count,
      count(*) FILTER (WHERE c.status = 'late') AS late_count,
      count(*) FILTER (WHERE c.status = 'excused') AS excused_count,
      count(*) FILTER (WHERE c.status = 'sick') AS sick_count,
      count(*) FILTER (WHERE c.status = 'absent') AS absent_count
    FROM public.class_subject_members csm
    JOIN public.class_members cm
      ON cm.class_id = csm.class_id
     AND cm.user_id = csm.user_id
    LEFT JOIN public.discussion_session_checkins c
      ON c.session_id = s.id
     AND c.user_id = cm.user_id
    WHERE csm.class_id = s.class_id
      AND csm.subject_id = s.subject_id
      AND cm.joined_at <= s.starts_at
      AND (
        cm.course_scope = 'all'
        OR EXISTS (
          SELECT 1
          FROM public.class_member_courses cmc
          WHERE cmc.class_id = s.class_id
            AND cmc.user_id = cm.user_id
            AND cmc.subject_id = s.subject_id
        )
      )
  ) t ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT a.user_id) AS failed_count
    FROM public.attendance_verification_attempts a
    WHERE a.session_id = s.id
      AND a.outcome NOT IN ('checked_in', 'already_checked_in')
  ) f ON TRUE
  WHERE s.class_id = p_class_id
    AND s.meeting_number IS NOT NULL
    AND s.status <> 'cancelled'
  ORDER BY s.meeting_number DESC;
END;
$$;


REVOKE ALL ON FUNCTION public.class_attendance_meeting_list (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.class_attendance_meeting_list (uuid) TO authenticated;


-- H-02 & H-11: Ketua privileges restricted to course_scope = 'all' & recall order fix
CREATE OR REPLACE FUNCTION public.maybe_grant_ketua_on_join () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_university uuid;
  v_is_elevated boolean := false;
BEGIN
  IF NEW.course_scope <> 'all' THEN
    RETURN NEW;
  END IF;

  IF NEW.joined_via IN ('lecturer_assignment', 'admin_assignment', 'platform_assignment') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_ketua_assignments
    WHERE class_id = NEW.class_id
      AND revoked_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  SELECT university_id INTO v_university
  FROM public.classes
  WHERE id = NEW.class_id;

  SELECT
    public.is_platform_admin ()
    OR (
      v_university IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.university_memberships m
        WHERE m.user_id = NEW.user_id
          AND m.status = 'active'
          AND m.role IN ('lecturer', 'university_admin')
          AND m.university_id = v_university
      )
    )
  INTO v_is_elevated;

  IF v_is_elevated THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.classes c
  WHERE c.id = NEW.class_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.class_ketua_assignments
    WHERE class_id = NEW.class_id
      AND revoked_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.grant_ketua_kelas (NEW.class_id, NEW.user_id, 'auto_first_join');

    PERFORM public.record_audit (
      'ketua_kelas_auto_granted',
      'class_ketua_assignment',
      NEW.class_id,
      NEW.class_id,
      jsonb_build_object('user_id', NEW.user_id, 'source', 'auto_first_join')
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM public.record_audit (
        'ketua_kelas_auto_grant_failed',
        'class_member',
        NEW.class_id,
        NEW.class_id,
        jsonb_build_object('user_id', NEW.user_id, 'error_code', SQLSTATE)
      );
  END;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.become_class_representative (p_class_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_class_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_ketua_assignments
    WHERE class_id = p_class_id
      AND user_id = v_user
      AND revoked_at IS NOT NULL
      AND removed_reason = 'recall_passed'
  ) THEN
    RETURN 'recalled';
  END IF;

  SELECT status INTO v_class_status
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'class_not_found';
  END IF;

  IF v_class_status IS DISTINCT FROM 'active' THEN
    RETURN 'class_inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members
    WHERE class_id = p_class_id
      AND user_id = v_user
      AND course_scope = 'all'
  ) THEN
    RETURN 'not_member';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_admins
    WHERE class_id = p_class_id
      AND user_id = v_user
  ) THEN
    RETURN 'already_representative';
  END IF;

  IF (
    SELECT count(*)
    FROM public.class_admins
    WHERE class_id = p_class_id
  ) >= 5 THEN
    RETURN 'limit_reached';
  END IF;

  INSERT INTO public.class_admins (class_id, user_id, assigned_by)
  VALUES (p_class_id, v_user, v_user);

  PERFORM public.record_audit (
    'class_representative_direct_grant',
    'class_admin',
    NULL,
    p_class_id,
    jsonb_build_object('granted_via', 'direct')
  );

  RETURN 'granted';
END;
$$;


REVOKE ALL ON FUNCTION public.become_class_representative (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.become_class_representative (uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.ketua_recall_threshold (p_class_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT (count(*) + 1) / 2
  FROM public.class_members
  WHERE class_id = p_class_id
    AND course_scope = 'all';
$$;


REVOKE ALL ON FUNCTION public.ketua_recall_threshold (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.ketua_recall_threshold (uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.open_ketua_recall (p_class_id uuid, p_reason text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid ();
  v_recall_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members m
    WHERE m.class_id = p_class_id
      AND m.user_id = v_user
      AND m.course_scope = 'all'
  ) THEN
    RAISE EXCEPTION 'full class membership required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_ketua_assignments
    WHERE class_id = p_class_id
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'this class has no ketua to recall' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_ketua_recalls
    WHERE class_id = p_class_id
      AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'a recall petition is already open for this class' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.class_ketua_recalls (class_id, opened_by, reason, status)
  VALUES (
    p_class_id,
    v_user,
    nullif(btrim(coalesce(p_reason, '')), ''),
    'open'
  )
  RETURNING id INTO v_recall_id;

  INSERT INTO public.class_ketua_recall_votes (recall_id, user_id)
  VALUES (v_recall_id, v_user)
  ON CONFLICT DO NOTHING;

  PERFORM public.record_audit (
    'ketua_recall_opened',
    'class_ketua_recall',
    v_recall_id,
    p_class_id,
    jsonb_build_object('opened_by', v_user)
  );

  RETURN v_recall_id;
END;
$$;


REVOKE ALL ON FUNCTION public.open_ketua_recall (uuid, text)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.open_ketua_recall (uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.cast_ketua_recall_vote (p_recall_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid ();
  v_recall public.class_ketua_recalls;
  v_threshold integer;
  v_votes integer;
  v_assignment public.class_ketua_assignments;
  v_acting uuid;
  v_university uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_recall
  FROM public.class_ketua_recalls
  WHERE id = p_recall_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recall petition not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_recall.status <> 'open' THEN
    RAISE EXCEPTION 'recall petition is not open' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members m
    WHERE m.class_id = v_recall.class_id
      AND m.user_id = v_user
      AND m.course_scope = 'all'
  ) THEN
    RAISE EXCEPTION 'full class membership required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.class_ketua_recall_votes (recall_id, user_id)
  VALUES (p_recall_id, v_user)
  ON CONFLICT (recall_id, user_id) DO NOTHING;

  SELECT count(*) INTO v_votes
  FROM public.class_ketua_recall_votes
  WHERE recall_id = p_recall_id;

  v_threshold := public.ketua_recall_threshold (v_recall.class_id);

  IF v_votes < v_threshold THEN
    RETURN jsonb_build_object('status', 'open', 'votes', v_votes, 'threshold', v_threshold);
  END IF;

  SELECT * INTO v_assignment
  FROM public.class_ketua_assignments
  WHERE class_id = v_recall.class_id
    AND revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.class_ketua_recalls
    SET status = 'passed', decided_at = now()
    WHERE id = p_recall_id;

    RETURN jsonb_build_object('status', 'passed', 'votes', v_votes, 'threshold', v_threshold, 'acting_user_id', NULL);
  END IF;

  UPDATE public.class_ketua_recalls
  SET status = 'passed', decided_at = now()
  WHERE id = p_recall_id;

  SELECT m.user_id INTO v_acting
  FROM public.class_members m
  WHERE m.class_id = v_recall.class_id
    AND m.course_scope = 'all'
    AND m.user_id <> v_assignment.user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.class_admins ca
      WHERE ca.class_id = v_recall.class_id
        AND ca.user_id = m.user_id
    )
  ORDER BY m.joined_at ASC
  LIMIT 1;

  UPDATE public.class_ketua_assignments
  SET revoked_at = now(), removed_reason = 'recall_passed'
  WHERE id = v_assignment.id;

  -- Appoint acting ketua BEFORE revoking the outgoing ketua's admin assignment
  -- so guard_last_class_admin never aborts the succession.
  IF v_acting IS NOT NULL THEN
    PERFORM public.grant_ketua_kelas (v_recall.class_id, v_acting, 'acting_recall');
  END IF;

  v_university := public.class_university (v_recall.class_id);

  DELETE FROM public.class_admins
  WHERE class_id = v_recall.class_id
    AND user_id = v_assignment.user_id;

  IF v_university IS NOT NULL THEN
    UPDATE public.class_admin_assignments a
    SET revoked_at = now(), revoked_by = v_user
    WHERE a.class_id = v_recall.class_id
      AND a.user_id = v_assignment.user_id
      AND a.revoked_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.class_admin_assignments a2
        WHERE a2.class_id = v_recall.class_id
          AND a2.revoked_at IS NULL
          AND a2.id <> a.id
      );
  END IF;

  PERFORM public.record_audit (
    'ketua_recall_passed',
    'class_ketua_recall',
    p_recall_id,
    v_recall.class_id,
    jsonb_build_object('votes', v_votes, 'threshold', v_threshold, 'acting_user_id', v_acting)
  );

  PERFORM public.enqueue_notification_event (
    v_assignment.user_id,
    'class_ketua_recalled',
    'ketua_recall:' || p_recall_id::text,
    jsonb_build_object(
      'title', 'Peran ketua kelas kamu dicabut',
      'body', 'Cohort setuju untuk recall melalui petisi.',
      'url', '/classes'
    )
  );

  RETURN jsonb_build_object('status', 'passed', 'votes', v_votes, 'threshold', v_threshold, 'acting_user_id', v_acting);
END;
$$;


REVOKE ALL ON FUNCTION public.cast_ketua_recall_vote (uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.cast_ketua_recall_vote (uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. H-06: Harden and revoke sync_offline_attendance_meeting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_offline_attendance_meeting (
  p_session_id uuid,
  p_full_name text,
  p_nim text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz,
  p_time_from_gnss boolean DEFAULT TRUE,
  p_device_clock_auto boolean DEFAULT TRUE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_session public.discussion_sessions %ROWTYPE;
  v_profile public.profiles %ROWTYPE;
  v_checkin public.discussion_session_checkins %ROWTYPE;
  v_distance double precision;
  v_new_status text;
  v_checkin_id uuid;
  v_joined_at timestamptz;
  v_offline_note text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to check in' USING ERRCODE = '42501';
  END IF;

  IF p_latitude IS NULL
     OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Invalid coordinates' USING ERRCODE = '22023';
  END IF;

  IF p_captured_at IS NULL THEN
    RAISE EXCEPTION 'Missing capture time' USING ERRCODE = '22023';
  END IF;

  IF p_captured_at > now() + interval '5 minutes'
     OR p_captured_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_stale_position',
      'message', 'This offline reading is too old to trust. Ask your class admin to mark you present manually.'
    );
  END IF;

  SELECT * INTO v_session
  FROM public.discussion_sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_class_member (v_session.class_id) THEN
    RAISE EXCEPTION 'Only class members can check in' USING ERRCODE = '42501';
  END IF;

  IF v_session.subject_id IS NOT NULL
     AND (
       NOT public.can_access_course_subject (v_session.class_id, v_session.subject_id)
       OR NOT EXISTS (
         SELECT 1
         FROM public.class_subject_members em
         WHERE em.class_id = v_session.class_id
           AND em.subject_id = v_session.subject_id
           AND em.user_id = v_user_id
       )
     ) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'You are not enrolled in this course, so this meeting is not part of your attendance.'
    );
  END IF;

  SELECT m.joined_at INTO v_joined_at
  FROM public.class_members m
  WHERE m.class_id = v_session.class_id
    AND m.user_id = v_user_id;

  IF v_joined_at IS NULL
     OR v_joined_at > v_session.starts_at THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'You joined this class after the meeting started, so this meeting is not part of your attendance.'
    );
  END IF;

  IF v_session.meeting_number IS NULL THEN
    RAISE EXCEPTION 'This session is not an attendance meeting' USING ERRCODE = '22023';
  END IF;

  IF v_session.status <> 'scheduled' THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'This meeting is not open for check-in.'
    );
  END IF;

  IF v_session.attendance_opened_at IS NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_open');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_not_open',
      'message', 'Attendance had not been opened for this meeting.'
    );
  END IF;

  IF p_captured_at < v_session.attendance_opened_at THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_open');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_not_open',
      'message', 'This reading was captured before attendance opened.'
    );
  END IF;

  IF v_session.attendance_finalized_at IS NOT NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'Attendance for this meeting has already been finalized.'
    );
  END IF;

  IF v_session.attendance_closed_at IS NOT NULL
     AND p_captured_at > v_session.attendance_closed_at THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'Attendance for this meeting had closed before this reading was captured.'
    );
  END IF;

  IF p_captured_at > coalesce(v_session.attendance_closes_at, v_session.ends_at) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'closed');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_closed',
      'message', 'This reading was captured after the attendance window ended.'
    );
  END IF;

  IF v_session.checkin_latitude IS NULL
     OR v_session.checkin_longitude IS NULL THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'not_available');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_unavailable',
      'message', 'This meeting has no attendance location configured.'
    );
  END IF;

  IF p_accuracy_m IS NULL
     OR p_accuracy_m < 0
     OR p_accuracy_m > 100 THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'imprecise', NULL, p_accuracy_m);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_imprecise',
      'message', 'Your location reading is not accurate enough. Move somewhere with a clearer signal and try again.',
      'accuracyM', p_accuracy_m,
      'maxAccuracyM', 100
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF NOT FOUND
     OR public.attendance_normalize_identity (v_profile.full_name) = ''
     OR public.attendance_normalize_identity (v_profile.nim) = '' THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'identity_missing');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_identity_missing',
      'message', 'Add your full name and NIM in your profile before checking in.'
    );
  END IF;

  IF public.attendance_normalize_identity (p_full_name) <> public.attendance_normalize_identity (v_profile.full_name) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'name_mismatch');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_name_mismatch',
      'message', 'The name you entered does not match your verified profile. Correct it in your profile, then try again.'
    );
  END IF;

  IF public.attendance_normalize_identity (p_nim) <> public.attendance_normalize_identity (v_profile.nim) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'nim_mismatch');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_nim_mismatch',
      'message', 'The NIM you entered does not match your verified profile. Correct it in your profile, then try again.'
    );
  END IF;

  v_distance := public.distance_meters (
    p_latitude,
    p_longitude,
    v_session.checkin_latitude,
    v_session.checkin_longitude
  );

  IF v_distance > v_session.checkin_radius_m THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'outside_radius', v_distance, p_accuracy_m);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'checkin_too_far',
      'message', 'Please go to your class meeting point and try again.'
    );
  END IF;

  SELECT * INTO v_checkin
  FROM public.discussion_session_checkins c
  WHERE c.session_id = p_session_id
    AND c.user_id = v_user_id;

  IF FOUND
     AND NOT (
       v_checkin.method IN ('manual', 'system')
       AND v_checkin.reviewed_at IS NULL
     ) THEN
    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'already_checked_in', v_checkin.distance_m, v_checkin.accuracy_m);
    RETURN jsonb_build_object(
      'ok', true,
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  END IF;

  v_new_status := 'present';

  v_offline_note :=
    'offline sync'
    || CASE WHEN NOT coalesce(p_time_from_gnss, true) THEN '; capture time not from GNSS fix' ELSE '' END
    || CASE WHEN NOT coalesce(p_device_clock_auto, true) THEN '; device clock set manually at capture' ELSE '' END;

  IF v_checkin.id IS NOT NULL THEN
    UPDATE public.discussion_session_checkins
    SET
      status = v_new_status,
      method = 'offline_sync',
      latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = p_accuracy_m,
      distance_m = v_distance,
      checked_in_at = p_captured_at,
      note = v_offline_note,
      identity_verified = true,
      identity_verified_at = now(),
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now()
    WHERE id = v_checkin.id
    RETURNING id INTO v_checkin_id;
  ELSE
    INSERT INTO public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      latitude,
      longitude,
      accuracy_m,
      distance_m,
      note,
      identity_verified,
      identity_verified_at,
      checked_in_at
    )
    VALUES (
      p_session_id,
      v_user_id,
      v_new_status,
      'offline_sync',
      p_latitude,
      p_longitude,
      p_accuracy_m,
      v_distance,
      v_offline_note,
      true,
      now(),
      p_captured_at
    )
    ON CONFLICT (session_id, user_id) DO NOTHING
    RETURNING id INTO v_checkin_id;
  END IF;

  IF v_checkin_id IS NULL THEN
    SELECT * INTO v_checkin
    FROM public.discussion_session_checkins c
    WHERE c.session_id = p_session_id
      AND c.user_id = v_user_id;

    PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'already_checked_in', v_checkin.distance_m, v_checkin.accuracy_m);

    RETURN jsonb_build_object(
      'ok', true,
      'id', v_checkin.id,
      'status', v_checkin.status,
      'checked_in_at', v_checkin.checked_in_at,
      'distance_m', v_checkin.distance_m,
      'accuracy_m', v_checkin.accuracy_m,
      'already_checked_in', true
    );
  END IF;

  PERFORM public.log_attendance_verification (p_session_id, v_user_id, 'checked_in', v_distance, p_accuracy_m);

  PERFORM public.record_audit (
    'attendance_meeting_offline_sync',
    'discussion_session',
    p_session_id,
    v_session.class_id,
    jsonb_build_object(
      'status', v_new_status,
      'distance_m', round(v_distance),
      'captured_at', to_char(p_captured_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'time_from_gnss', coalesce(p_time_from_gnss, true),
      'device_clock_auto', coalesce(p_device_clock_auto, true)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_checkin_id,
    'status', v_new_status,
    'checked_in_at', p_captured_at,
    'distance_m', v_distance,
    'accuracy_m', p_accuracy_m,
    'already_checked_in', false
  );
END;
$$;


REVOKE ALL ON FUNCTION public.sync_offline_attendance_meeting (
  uuid,
  text,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz,
  boolean,
  boolean
)
FROM
  PUBLIC,
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- 8. H-11, M-01 (DB), B-05 (DB)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_lecturer_membership_if_eligible (
  p_user_id uuid,
  p_email text,
  p_verification_method text DEFAULT 'domain_email_auto',
  p_university_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_domain text;
  v_university public.universities;
  v_existing public.university_memberships;
  v_membership_id uuid;
BEGIN
  v_domain := split_part(lower(btrim(coalesce(p_email, ''))), '@', 2);

  IF v_domain = '' THEN
    RETURN NULL;
  END IF;

  SELECT uni.* INTO v_university
  FROM public.universities uni
  WHERE uni.status = 'active'
    AND (
      p_university_id IS NULL
      OR uni.id = p_university_id
    )
    AND EXISTS (
      SELECT 1
      FROM unnest(uni.institutional_domains) AS d
      WHERE d = v_domain
        OR (
          d LIKE '*.%'
          AND v_domain LIKE '%.' || substr(d, 3)
          AND v_domain !~ '^(mhs|mahasiswa|student|students|alumni|mail\.student)\.'
        )
    )
  ORDER BY uni.slug
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_existing
  FROM public.university_memberships m
  WHERE m.user_id = p_user_id
    AND m.university_id = v_university.id
  FOR UPDATE;

  IF FOUND AND v_existing.lecturer_revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF FOUND AND v_existing.status = 'suspended' THEN
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.university_memberships (
    user_id,
    university_id,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_university.id,
    'lecturer',
    'active',
    now(),
    now()
  )
  ON CONFLICT (user_id, university_id) DO UPDATE
  SET
    role = CASE
      WHEN public.university_memberships.role = 'university_admin' THEN public.university_memberships.role
      ELSE 'lecturer'
    END,
    status = CASE
      WHEN public.university_memberships.status = 'suspended' THEN public.university_memberships.status
      ELSE 'active'
    END,
    updated_at = now()
  RETURNING id INTO v_membership_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    university_id,
    metadata
  )
  VALUES (
    p_user_id,
    'lecturer_persona_auto_granted',
    'university_membership',
    v_membership_id,
    v_university.id,
    jsonb_build_object(
      'university_id', v_university.id,
      'verification_method', p_verification_method
    )
  );

  PERFORM public.enqueue_notification_event (
    p_user_id,
    'membership_role_updated',
    'lecturer_claim:' || v_membership_id,
    jsonb_build_object(
      'title', 'Persona dosen StarsTask diaktifkan',
      'body', 'Email institusimu cocok dengan universitas terdaftar. Akses dosen dibatasi ke kelas yang kamu kelola.',
      'url', '/lecturer'
    )
  );

  RETURN v_membership_id;
END;
$$;


REVOKE ALL ON FUNCTION public.grant_lecturer_membership_if_eligible (uuid, text, text, uuid)
FROM
  PUBLIC,
  anon,
  authenticated;


CREATE OR REPLACE FUNCTION public.claim_lecturer_persona (p_nidn text DEFAULT NULL, p_university_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid ();
  v_email text;
  v_domain text;
  v_nidn text := nullif(btrim(coalesce(p_nidn, '')), '');
  v_membership_id uuid;
  v_email_confirmed boolean := false;
  v_university_id uuid := p_university_id;
  v_match_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_nidn IS NOT NULL AND v_nidn !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'NIDN must be exactly 10 digits' USING ERRCODE = '22023';
  END IF;

  SELECT lower(u.email), (u.email_confirmed_at IS NOT NULL)
  INTO v_email, v_email_confirmed
  FROM auth.users u
  WHERE u.id = v_user;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'account has no email address' USING ERRCODE = '42501';
  END IF;

  IF NOT v_email_confirmed THEN
    RAISE EXCEPTION 'confirm your institutional email before claiming the lecturer persona' USING ERRCODE = '42501';
  END IF;

  v_domain := split_part(v_email, '@', 2);

  IF v_domain = '' THEN
    RAISE EXCEPTION 'account email is malformed' USING ERRCODE = '42501';
  END IF;

  IF v_university_id IS NULL THEN
    SELECT count(*) INTO v_match_count
    FROM public.universities uni
    WHERE uni.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM unnest(uni.institutional_domains) AS d
        WHERE d = v_domain
          OR (
            d LIKE '*.%'
            AND v_domain LIKE '%.' || substr(d, 3)
            AND v_domain !~ '^(mhs|mahasiswa|student|students|alumni|mail\.student)\.'
          )
      );

    IF v_match_count = 0 THEN
      RAISE EXCEPTION 'no active university is registered for the domain %; ask the platform operator to add it to institutional_domains', v_domain USING ERRCODE = '42501';
    ELSIF v_match_count > 1 THEN
      RAISE EXCEPTION 'more than one university claims this email domain; pass p_university_id' USING ERRCODE = '22023';
    END IF;

    SELECT uni.id INTO v_university_id
    FROM public.universities uni
    WHERE uni.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM unnest(uni.institutional_domains) AS d
        WHERE d = v_domain
          OR (
            d LIKE '*.%'
            AND v_domain LIKE '%.' || substr(d, 3)
            AND v_domain !~ '^(mhs|mahasiswa|student|students|alumni|mail\.student)\.'
          )
      )
    LIMIT 1;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.universities uni
      WHERE uni.id = v_university_id
        AND uni.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM unnest(uni.institutional_domains) AS d
          WHERE d = v_domain
            OR (
              d LIKE '*.%'
              AND v_domain LIKE '%.' || substr(d, 3)
              AND v_domain !~ '^(mhs|mahasiswa|student|students|alumni|mail\.student)\.'
            )
        )
    ) THEN
      RAISE EXCEPTION 'your email domain is not registered as institutional for that university, or the university is not active' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.university_memberships m
    WHERE m.user_id = v_user
      AND m.university_id = v_university_id
      AND m.lecturer_revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'lecturer role was revoked by an administrator' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.university_memberships m
    WHERE m.user_id = v_user
      AND m.university_id = v_university_id
      AND m.status = 'suspended'
  ) THEN
    RAISE EXCEPTION 'university membership is suspended' USING ERRCODE = '42501';
  END IF;

  v_membership_id := public.grant_lecturer_membership_if_eligible (
    v_user,
    v_email,
    CASE WHEN v_nidn IS NULL THEN 'domain_email_auto' ELSE 'domain_email_nidn_auto' END,
    v_university_id
  );

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'no active university is registered for the domain %', v_domain USING ERRCODE = '42501';
  END IF;

  RETURN v_membership_id;
END;
$$;


REVOKE ALL ON FUNCTION public.claim_lecturer_persona (text, uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.claim_lecturer_persona (text, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.set_university_member_role (
  p_university_id uuid,
  p_user_id uuid,
  p_role text,
  p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_caller uuid := auth.uid ();
  v_membership public.university_memberships;
  v_old_role text;
  v_new_role text := lower(btrim(coalesce(p_role, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_membership_id uuid;
  v_is_platform boolean := false;
  v_revoked_at timestamptz;
  v_replacement uuid;
  v_solo record;
  v_new_assign_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_new_role NOT IN ('student', 'lecturer', 'university_admin') THEN
    RAISE EXCEPTION 'unknown role' USING ERRCODE = '22023';
  END IF;

  v_is_platform := public.is_platform_admin ();

  IF NOT (v_is_platform OR public.is_university_admin (p_university_id)) THEN
    RAISE EXCEPTION 'university admin required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_caller AND NOT v_is_platform THEN
    RAISE EXCEPTION 'cannot change your own role' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_membership
  FROM public.university_memberships m
  WHERE m.user_id = p_user_id
    AND m.university_id = p_university_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_membership.status <> 'active' THEN
    RAISE EXCEPTION 'only active memberships can change role' USING ERRCODE = '22023';
  END IF;

  v_old_role := v_membership.role;

  IF NOT v_is_platform THEN
    IF v_old_role = 'university_admin' THEN
      RAISE EXCEPTION 'only a platform admin may change a university admin' USING ERRCODE = '42501';
    END IF;

    IF v_new_role NOT IN ('student', 'lecturer') THEN
      RAISE EXCEPTION 'only platform admins may grant or revoke university_admin' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_old_role = v_new_role THEN
    RETURN v_membership.id;
  END IF;

  v_revoked_at := CASE
    WHEN v_new_role = 'student' AND v_old_role IN ('lecturer', 'university_admin') THEN now()
    WHEN v_new_role IN ('lecturer', 'university_admin') THEN NULL
    ELSE v_membership.lecturer_revoked_at
  END;

  UPDATE public.university_memberships
  SET
    role = v_new_role,
    lecturer_revoked_at = v_revoked_at,
    updated_at = now()
  WHERE id = v_membership.id
  RETURNING id INTO v_membership_id;

  IF v_new_role = 'student' AND v_old_role IN ('lecturer', 'university_admin') THEN
    v_replacement := nullif(v_caller, p_user_id);

    IF v_replacement IS NULL THEN
      SELECT m.user_id INTO v_replacement
      FROM public.university_memberships m
      WHERE m.university_id = p_university_id
        AND m.role IN ('university_admin', 'admin')
        AND m.status = 'active'
        AND m.user_id <> p_user_id
      ORDER BY m.created_at ASC
      LIMIT 1;
    END IF;

    -- Transfer solo classes to the acting admin (and archive empty solo classes)
    -- BEFORE revoking class_admin_assignments so guard_last_class_admin stays satisfied.
    FOR v_solo IN
      SELECT c.id
      FROM public.classes c
      JOIN public.class_admin_assignments a ON a.class_id = c.id
      WHERE c.university_id = p_university_id
        AND a.user_id = p_user_id
        AND a.revoked_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.class_admin_assignments a2
          WHERE a2.class_id = c.id
            AND a2.revoked_at IS NULL
            AND a2.user_id IS DISTINCT FROM p_user_id
        )
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.class_members cm
        WHERE cm.class_id = v_solo.id
          AND cm.user_id <> p_user_id
      ) THEN
        UPDATE public.classes
        SET status = 'archived', updated_at = now()
        WHERE id = v_solo.id
          AND status <> 'archived';
      END IF;

      IF v_replacement IS NOT NULL THEN
        INSERT INTO public.class_members (
          class_id,
          user_id,
          joined_via,
          course_scope
        )
        VALUES (
          v_solo.id,
          v_replacement,
          CASE WHEN v_is_platform THEN 'platform_assignment' ELSE 'admin_assignment' END,
          'all'
        )
        ON CONFLICT (class_id, user_id) DO NOTHING;

        INSERT INTO public.class_admins (class_id, user_id, assigned_by)
        VALUES (v_solo.id, v_replacement, v_caller)
        ON CONFLICT (class_id, user_id) DO NOTHING;

        INSERT INTO public.class_admin_assignments (
          university_id,
          class_id,
          user_id,
          granted_by
        )
        VALUES (p_university_id, v_solo.id, v_replacement, v_caller)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_new_assign_id;

        IF v_new_assign_id IS NOT NULL THEN
          INSERT INTO public.class_admin_permissions (assignment_id, permission_code)
          SELECT v_new_assign_id, unnest(ARRAY[
            'manage_admins',
            'manage_attendance',
            'manage_assignments',
            'manage_announcements',
            'manage_grades',
            'manage_schedule',
            'manage_materials',
            'manage_leave_review'
          ])
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;

    DELETE FROM public.class_admins ca USING public.classes c
    WHERE ca.class_id = c.id
      AND ca.user_id = p_user_id
      AND c.university_id = p_university_id;

    UPDATE public.class_admin_assignments a
    SET
      revoked_at = now(),
      revoked_by = v_caller
    FROM public.classes c
    WHERE a.class_id = c.id
      AND a.user_id = p_user_id
      AND a.revoked_at IS NULL
      AND c.university_id = p_university_id
      AND EXISTS (
        SELECT 1
        FROM public.class_admin_assignments a2
        WHERE a2.class_id = a.class_id
          AND a2.revoked_at IS NULL
          AND a2.id <> a.id
      );
  END IF;

  PERFORM public.record_audit (
    'university_membership_role_updated',
    'university_membership',
    v_membership_id,
    NULL,
    jsonb_build_object(
      'university_id', p_university_id,
      'from', v_old_role,
      'to', v_new_role,
      'reason', v_reason
    )
  );

  PERFORM public.enqueue_notification_event (
    p_user_id,
    'membership_role_updated',
    'membership_role:' || v_membership_id || ':' || v_new_role,
    jsonb_build_object(
      'title', 'Peran kamu di universitas diperbarui',
      'body', 'Perannya berubah dari ' || v_old_role || ' menjadi ' || v_new_role || '.',
      'url', '/university'
    )
  );

  RETURN v_membership_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'role update conflicted with another transaction' USING ERRCODE = '23505';
END;
$$;


REVOKE ALL ON FUNCTION public.set_university_member_role (uuid, uuid, text, text)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.set_university_member_role (uuid, uuid, text, text) TO authenticated;


-- M-01 (DB): Revoke direct client INSERT on export_jobs (server inserts via service_role)
REVOKE INSERT ON public.export_jobs
FROM
  authenticated;


DROP POLICY IF EXISTS export_jobs_insert_own ON public.export_jobs;


COMMENT ON TABLE public.export_jobs IS 'Async export queue. Writers: service_role server routes/workers only. Clients can only SELECT their own jobs.';


-- B-05 (DB): auto_cutoff_expired_attendance_meetings default >= 60m + subject-scoped leave check
CREATE OR REPLACE FUNCTION public.auto_cutoff_expired_attendance_meetings (p_cutoff_minutes integer DEFAULT 120) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_cutoff_minutes integer := GREATEST(COALESCE(p_cutoff_minutes, 120), 60);
  v_inserted_count integer := 0;
BEGIN
  WITH expired_meetings AS (
    SELECT
      am.id,
      am.university_id,
      am.offering_id,
      am.scheduled_at,
      am.created_by,
      co.class_id,
      co.course_id
    FROM public.attendance_meetings am
    JOIN public.course_offerings co
      ON co.id = am.offering_id
     AND co.university_id = am.university_id
    WHERE am.status IN ('scheduled', 'open')
      AND am.scheduled_at + make_interval(mins => v_cutoff_minutes) <= now()
  ),
  inserted_records AS (
    INSERT INTO public.attendance_records (
      university_id,
      meeting_id,
      student_identity_id,
      status,
      recorded_by,
      note
    )
    SELECT
      em.university_id,
      em.id,
      e.student_identity_id,
      'absent',
      em.created_by,
      'Auto-cutoff: no attendance recorded before deadline.'
    FROM expired_meetings em
    JOIN public.enrollments e
      ON e.offering_id = em.offering_id
     AND e.university_id = em.university_id
     AND e.status = 'active'
    JOIN public.student_identities si
      ON si.id = e.student_identity_id
     AND si.university_id = e.university_id
    JOIN public.university_memberships um
      ON um.id = si.university_membership_id
     AND um.university_id = si.university_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.attendance_records ar
      WHERE ar.meeting_id = em.id
        AND ar.student_identity_id = e.student_identity_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.student_id = um.user_id
        AND lr.class_id = em.class_id
        AND lr.status IN ('approved', 'forwarded')
        AND lr.leave_start_date IS NOT NULL
        AND lr.leave_end_date IS NOT NULL
        AND (em.scheduled_at AT TIME ZONE 'Asia/Jakarta')::date
            BETWEEN lr.leave_start_date AND lr.leave_end_date
        AND (
          coalesce(cardinality(lr.subject_ids), 0) = 0
          OR EXISTS (
            SELECT 1
            FROM public.class_subjects cs
            WHERE cs.class_id = em.class_id
              AND cs.course_id = em.course_id
              AND cs.id = ANY (lr.subject_ids)
          )
        )
    )
    ON CONFLICT (meeting_id, student_identity_id) DO NOTHING
    RETURNING 1
  ),
  closed_meetings AS (
    UPDATE public.attendance_meetings am
    SET status = 'closed'
    FROM expired_meetings em
    WHERE am.id = em.id
      AND am.status IN ('scheduled', 'open')
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted_count
  FROM inserted_records;

  RETURN coalesce(v_inserted_count, 0);
END;
$$;


REVOKE ALL ON FUNCTION public.auto_cutoff_expired_attendance_meetings (integer)
FROM
  PUBLIC,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.auto_cutoff_expired_attendance_meetings (integer) TO service_role;
