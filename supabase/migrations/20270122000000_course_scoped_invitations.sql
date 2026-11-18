-- Course-scoped class invitations.
-- Allows class admins to invite students to a single course (`subject_id`)
-- using `class_members.course_scope = 'selected'` + `class_member_courses`.
ALTER TABLE public.class_invitations
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.class_subjects (id) ON DELETE CASCADE;


CREATE INDEX IF NOT EXISTS class_invitations_subject_idx ON public.class_invitations (class_id, subject_id, created_at DESC)
WHERE
  subject_id IS NOT NULL;


DROP FUNCTION IF EXISTS public.create_class_invitation (uuid, text, timestamptz, integer, text);


CREATE OR REPLACE FUNCTION public.create_class_invitation (
  p_class_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_max_uses integer DEFAULT 1,
  p_email_restriction text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_email text := nullif(lower(btrim(coalesce(p_email_restriction, ''))), '');
  v_id uuid;
  v_invitee uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'class admin required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'class is not active' USING ERRCODE = '22023';
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.class_subjects s
    WHERE s.id = p_subject_id
      AND s.class_id = p_class_id
  ) THEN
    RAISE EXCEPTION 'subject not found in class' USING ERRCODE = 'P0002';
  END IF;

  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid invitation token hash' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at IS NULL
    OR p_expires_at <= now()
    OR p_expires_at > now() + interval '90 days' THEN
    RAISE EXCEPTION 'invalid invitation expiry' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.class_invitations (
    class_id,
    subject_id,
    created_by,
    token_hash,
    email_restriction,
    expires_at,
    max_uses
  )
  VALUES (
    p_class_id,
    p_subject_id,
    v_user,
    v_hash,
    v_email,
    p_expires_at,
    coalesce(p_max_uses, 1)
  )
  RETURNING id INTO v_id;

  PERFORM public.record_audit (
    'class_invitation_created',
    'class_invitation',
    v_id,
    p_class_id,
    jsonb_build_object(
      'max_uses', coalesce(p_max_uses, 1),
      'email_restricted', v_email IS NOT NULL,
      'subject_scoped', p_subject_id IS NOT NULL
    )
  );

  IF v_email IS NOT NULL THEN
    SELECT u.id INTO v_invitee
    FROM auth.users u
    WHERE lower(u.email) = v_email
    LIMIT 1;

    IF v_invitee IS NOT NULL THEN
      PERFORM public.enqueue_notification_event (
        v_invitee,
        'class_invitation',
        'class_invitation:' || v_id,
        jsonb_build_object(
          'title', CASE WHEN p_subject_id IS NOT NULL THEN 'Course invitation' ELSE 'Class invitation' END,
          'body', CASE WHEN p_subject_id IS NOT NULL THEN 'You were invited to join a course on StarsTask.' ELSE 'You were invited to join a class on StarsTask.' END,
          'url', '/app'
        )
      );
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


REVOKE ALL ON FUNCTION public.create_class_invitation (uuid, text, timestamptz, integer, text, uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.create_class_invitation (uuid, text, timestamptz, integer, text, uuid) TO authenticated;


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
    IF v_existing_scope IS NOT NULL THEN
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
    INSERT INTO public.class_members (class_id, user_id, joined_via, course_scope)
    VALUES (v_inv.class_id, v_user, 'invitation', 'all');
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

  UPDATE public.class_invitations
  SET used_count = used_count + 1
  WHERE id = v_inv.id;

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
