-- Audit fixes (T3):
-- 1. Harden dm_sender_keys_owner_update WITH CHECK to verify active dm_participants.
-- 2. Increment class_invitations.used_count only when class_invitation_acceptances inserts a row.
-- 3. Add CHECK constraints on class_export_branding matching exportBrandingSchema bounds.
-- 1. Harden dm_sender_keys_owner_update RLS policy
DROP POLICY IF EXISTS dm_sender_keys_owner_update ON public.dm_sender_keys;


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


-- 2. Fix used_count double-increment edge case in accept_class_invitation & accept_pending_invitation
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

  IF FOUND THEN
    UPDATE public.class_invitations
    SET used_count = used_count + 1
    WHERE id = v_inv.id;
  END IF;

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


-- 3. Add DB-level CHECK constraints on class_export_branding matching exportBrandingSchema
ALTER TABLE public.class_export_branding
DROP CONSTRAINT IF EXISTS class_export_branding_passing_threshold_check,
DROP CONSTRAINT IF EXISTS class_export_branding_university_name_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_university_short_name_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_university_tagline_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_faculty_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_department_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_study_program_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_address_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_city_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_official_website_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_official_email_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_contact_number_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_document_title_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_footer_text_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_product_name_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_product_tagline_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_product_logo_url_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_product_footer_len_check,
DROP CONSTRAINT IF EXISTS class_export_branding_university_logo_url_len_check;


ALTER TABLE public.class_export_branding
ADD CONSTRAINT class_export_branding_passing_threshold_check CHECK (
  passing_threshold >= 0
  AND passing_threshold <= 100
) NOT VALID,
ADD CONSTRAINT class_export_branding_university_name_len_check CHECK (char_length(university_name) <= 160) NOT VALID,
ADD CONSTRAINT class_export_branding_university_short_name_len_check CHECK (
  university_short_name IS NULL
  OR char_length(university_short_name) <= 60
) NOT VALID,
ADD CONSTRAINT class_export_branding_university_tagline_len_check CHECK (
  university_tagline IS NULL
  OR char_length(university_tagline) <= 160
) NOT VALID,
ADD CONSTRAINT class_export_branding_faculty_len_check CHECK (
  faculty IS NULL
  OR char_length(faculty) <= 160
) NOT VALID,
ADD CONSTRAINT class_export_branding_department_len_check CHECK (
  department IS NULL
  OR char_length(department) <= 160
) NOT VALID,
ADD CONSTRAINT class_export_branding_study_program_len_check CHECK (
  study_program IS NULL
  OR char_length(study_program) <= 160
) NOT VALID,
ADD CONSTRAINT class_export_branding_address_len_check CHECK (
  address IS NULL
  OR char_length(address) <= 300
) NOT VALID,
ADD CONSTRAINT class_export_branding_city_len_check CHECK (
  city IS NULL
  OR char_length(city) <= 120
) NOT VALID,
ADD CONSTRAINT class_export_branding_official_website_len_check CHECK (
  official_website IS NULL
  OR char_length(official_website) <= 300
) NOT VALID,
ADD CONSTRAINT class_export_branding_official_email_len_check CHECK (
  official_email IS NULL
  OR char_length(official_email) <= 160
) NOT VALID,
ADD CONSTRAINT class_export_branding_contact_number_len_check CHECK (
  contact_number IS NULL
  OR char_length(contact_number) <= 60
) NOT VALID,
ADD CONSTRAINT class_export_branding_document_title_len_check CHECK (char_length(document_title) <= 200) NOT VALID,
ADD CONSTRAINT class_export_branding_footer_text_len_check CHECK (
  footer_text IS NULL
  OR char_length(footer_text) <= 300
) NOT VALID,
ADD CONSTRAINT class_export_branding_product_name_len_check CHECK (char_length(product_name) <= 80) NOT VALID,
ADD CONSTRAINT class_export_branding_product_tagline_len_check CHECK (char_length(product_tagline) <= 120) NOT VALID,
ADD CONSTRAINT class_export_branding_product_logo_url_len_check CHECK (char_length(product_logo_url) <= 600) NOT VALID,
ADD CONSTRAINT class_export_branding_product_footer_len_check CHECK (
  product_footer IS NULL
  OR char_length(product_footer) <= 300
) NOT VALID,
ADD CONSTRAINT class_export_branding_university_logo_url_len_check CHECK (
  university_logo_url IS NULL
  OR char_length(university_logo_url) <= 600
) NOT VALID;
