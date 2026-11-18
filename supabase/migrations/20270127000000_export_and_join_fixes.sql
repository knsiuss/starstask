-- Fix Export storage bucket & Join Class invitation RPC/RLS bugs.
-- 1. Private `exports` storage bucket + owner SELECT policy
INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('exports', 'exports', FALSE)
ON CONFLICT (id) DO NOTHING;


DROP POLICY IF EXISTS exports_owner_read ON storage.objects;


CREATE POLICY exports_owner_read ON storage.objects FOR
SELECT
  TO authenticated USING (
    bucket_id = 'exports'
    AND (storage.foldername (name)) [1] = (
      SELECT
        auth.uid ()::text
    )
  );


-- 2. Restore anon execute on get_invitation_preview so /invite/[token] works before login
GRANT
EXECUTE ON FUNCTION public.get_invitation_preview (text) TO anon,
authenticated;


-- 3. Allow invited users to read their own pending email-restricted invitations
DROP POLICY IF EXISTS class_invitations_invited_email_read ON public.class_invitations;


CREATE POLICY class_invitations_invited_email_read ON public.class_invitations FOR
SELECT
  TO authenticated USING (
    email_restriction IS NOT NULL
    AND lower(email_restriction) = lower(
      coalesce(
        (
          SELECT
            auth.jwt () ->> 'email'
        ),
        ''
      )
    )
    AND revoked_at IS NULL
    AND (
      expires_at IS NULL
      OR expires_at > now()
    )
  );


-- 4. Upgrade course_scope from 'selected' to 'all' on class-wide invitations
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


-- 5. Respect subject_id and upgrade course_scope in accept_pending_invitation
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
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.class_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING errcode = 'P0002';
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
    RAISE EXCEPTION 'invitation revoked' USING errcode = '22023';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation expired' USING errcode = '22023';
  END IF;

  IF v_inv.used_count >= v_inv.max_uses THEN
    RAISE EXCEPTION 'invitation already fully used' USING errcode = '22023';
  END IF;

  SELECT status INTO v_class_status FROM public.classes WHERE id = v_inv.class_id;
  IF v_class_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'class is not active' USING errcode = '22023';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;
  IF v_inv.email_restriction IS NOT NULL THEN
    IF v_email IS NULL OR v_email <> lower(v_inv.email_restriction) THEN
      RAISE EXCEPTION 'invitation is restricted to another email address' USING errcode = '42501';
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
  ON CONFLICT (invitation_id, user_id) DO NOTHING;

  UPDATE public.class_invitations
  SET used_count = used_count + 1
  WHERE id = v_inv.id;

  PERFORM public.record_audit(
    'class_invitation_accepted',
    'class_invitation',
    v_inv.id,
    v_inv.class_id,
    jsonb_build_object('subject_id', v_inv.subject_id)
  );

  RETURN v_inv.class_id;
END;
$$;
