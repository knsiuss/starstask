-- Lecturer persona auto-activation at signup.
-- =====================================================================
-- Product decision (owner, 2026-11-13): a sign-up whose email is already
-- confirmed AND matches an active university's `institutional_domains` becomes
-- `lecturer` immediately — no onboarding question, no NIDN required at that
-- moment. The domain check IS the credential; it is not proof of employment
-- and never grants more than the classes its holder administers. Suspended
-- memberships are never resurrected; an existing university_admin keeps it.
--
-- Accounts created before this migration, or whose email is confirmed only
-- after insertion (magic-link / password flows), self-activate through
-- claim_lecturer_persona (20270116000000), which now also accepts a missing
-- NIDN. Google sign-in sets email_confirmed_at at insert, so OAuth signups get
-- the membership in the same transaction as the profile.
--
-- Rollback: restore update_my_profile and handle_new_user from
-- 20261029002700_profile_onboarding.sql; drop maybe_grant_lecturer_membership();
-- existing memberships are NOT reverted.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- Internal grant: insert a lecturer membership for one (user, university) pair
-- when the user's confirmed domain is registered there. No authorization reads;
-- called only from the signup trigger and the self-claim RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_lecturer_membership_if_eligible (
  p_user_id uuid,
  p_email text,
  p_verification_method text DEFAULT 'domain_email_auto'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_domain text;
  v_university public.universities;
  v_membership_id uuid;
BEGIN
  v_domain := split_part(lower(btrim(coalesce(p_email, ''))), '@', 2);

  IF v_domain = '' THEN
    RETURN NULL;
  END IF;

  SELECT uni.*
  INTO v_university
  FROM public.universities uni
  WHERE uni.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM unnest(uni.institutional_domains) AS d
      WHERE d = v_domain
        OR (d LIKE '*.%' AND v_domain LIKE '%.' || substr(d, 3))
    )
  ORDER BY uni.slug
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.university_memberships (
    user_id, university_id, role, status, created_at, updated_at
  ) VALUES (
    p_user_id, v_university.id, 'lecturer', 'active', now(), now()
  )
  ON CONFLICT (user_id, university_id) DO UPDATE
    SET role = CASE
          WHEN public.university_memberships.role = 'university_admin'
            THEN public.university_memberships.role
          ELSE 'lecturer'
        END,
        status = CASE
          WHEN public.university_memberships.status = 'suspended'
            THEN public.university_memberships.status
          ELSE 'active'
        END,
        updated_at = public.university_memberships.updated_at
  RETURNING id INTO v_membership_id;

  -- record_audit() has no university_id parameter and fills it from class_id or
  -- the actor's first membership; a fresh signup has neither, so write the row
  -- with the tenant key explicitly to satisfy the future-rows audit invariant.
  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, university_id, metadata
  ) VALUES (
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

  PERFORM public.enqueue_notification_event(
    p_user_id,
    'membership_role_updated',
    'lecturer_claim:' || v_membership_id,
    jsonb_build_object(
      'title', 'Persona dosen StarsTask diaktifkan',
      'body', 'Email institusimu cocok dengan universitas terdaftar. Akses dosen dibatasi ke kelas yang kamu kelola.',
      'url', '/app/lecturer'
    )
  );

  RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_lecturer_membership_if_eligible (uuid, text, text)
FROM public, anon, authenticated;

COMMENT ON FUNCTION public.grant_lecturer_membership_if_eligible (uuid, text, text) IS
  'Internal: enroll a confirmed account as lecturer for the active university whose institutional_domains match the email domain. No client grants; called by signup/confirmation triggers and the self-claim RPC.';

-- ---------------------------------------------------------------------------
-- handle_email_confirmed: accounts whose email becomes confirmed after insert
-- (magic-link, password reset, OTP) auto-activate here. The signup trigger
-- handles already-confirmed OAuth inserts; this closes the later-confirmation
-- path without any client interaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_lecturer_membership_if_eligible(
      NEW.id,
      NEW.email,
      'domain_email_auto'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_email_confirmed ()
FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmed ();

-- ---------------------------------------------------------------------------
-- handle_new_user: profiles as before, plus lecturer auto-claim for accounts
-- whose email is already confirmed at insert (Google OAuth). Unconfirmed
-- emails are handled by claim_lecturer_persona after confirmation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
  v_full_name text;
  v_avatar_url text;
BEGIN
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'StarsTask member'
  );
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), '')
  );
  v_avatar_url := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(btrim(new.raw_user_meta_data->>'picture'), '')
  );

  IF v_avatar_url IS NOT NULL
     AND v_avatar_url NOT LIKE 'https://%' THEN
    v_avatar_url := NULL;
  END IF;

  INSERT INTO public.profiles (id, display_name, full_name, avatar_url)
  VALUES (
    new.id,
    left(v_display_name, 80),
    left(v_full_name, 80),
    left(v_avatar_url, 2048)
  )
  ON CONFLICT (id) DO NOTHING;

  IF new.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_lecturer_membership_if_eligible(
      new.id,
      new.email,
      'domain_email_auto'
    );
  END IF;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- update_my_profile: NIM required only for accounts that are NOT lecturers.
-- Lecturers persist a NULL nim; university stays free text for everyone.
-- Persona is derived in the database from the caller's membership — never
-- from client input.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_profile (
  p_full_name text,
  p_nickname text,
  p_nim text,
  p_university text,
  p_declared_class text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid ();
  v_full text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_nim text := nullif(btrim(coalesce(p_nim, '')), '');
  v_uni text := nullif(btrim(coalesce(p_university, '')), '');
  v_class text := nullif(btrim(coalesce(p_declared_class, '')), '');
  v_is_lecturer boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_full IS NULL
     OR char_length(v_full) < 2
     OR char_length(v_full) > 80 THEN
    RAISE EXCEPTION 'invalid full name' USING ERRCODE = '22023';
  END IF;

  IF v_nick IS NULL
     OR char_length(v_nick) < 2
     OR char_length(v_nick) > 60 THEN
    RAISE EXCEPTION 'invalid nickname' USING ERRCODE = '22023';
  END IF;

  IF v_uni IS NULL
     OR char_length(v_uni) < 2
     OR char_length(v_uni) > 120 THEN
    RAISE EXCEPTION 'invalid university' USING ERRCODE = '22023';
  END IF;

  SELECT public.is_lecturer() INTO v_is_lecturer;

  IF NOT v_is_lecturer THEN
    IF v_nim IS NULL
       OR v_nim !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$' THEN
      RAISE EXCEPTION 'invalid NIM' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_nim := NULL;
  END IF;

  IF v_class IS NOT NULL
     AND char_length(v_class) > 60 THEN
    RAISE EXCEPTION 'invalid class name' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET
    full_name = v_full,
    display_name = v_nick,
    nim = v_nim,
    university = v_uni,
    declared_class_name = v_class,
    onboarded_at = coalesce(onboarded_at, now())
  WHERE id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN public.get_my_profile();
END;
$$;

-- ---------------------------------------------------------------------------
-- claim_lecturer_persona: NIDN optional (auto-claim may carry none); format
-- still enforced when supplied.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_lecturer_persona (
  p_nidn text DEFAULT NULL,
  p_university_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
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
    RAISE EXCEPTION 'confirm your institutional email before claiming the lecturer persona'
      USING ERRCODE = '42501';
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
          OR (d LIKE '*.%' AND v_domain LIKE '%.' || substr(d, 3))
      );

    IF v_match_count = 0 THEN
      RAISE EXCEPTION 'no active university is registered for the domain %; ask the platform operator to add it to institutional_domains', v_domain
        USING ERRCODE = '42501';
    ELSIF v_match_count > 1 THEN
      RAISE EXCEPTION 'more than one university claims this email domain; pass p_university_id'
        USING ERRCODE = '22023';
    END IF;

    SELECT uni.id INTO v_university_id
    FROM public.universities uni
    WHERE uni.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM unnest(uni.institutional_domains) AS d
        WHERE d = v_domain
          OR (d LIKE '*.%' AND v_domain LIKE '%.' || substr(d, 3))
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
            OR (d LIKE '*.%' AND v_domain LIKE '%.' || substr(d, 3))
        )
    ) THEN
      RAISE EXCEPTION 'your email domain is not registered as institutional for that university, or the university is not active'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_membership_id := public.grant_lecturer_membership_if_eligible(
    v_user,
    v_email,
    CASE WHEN v_nidn IS NULL THEN 'domain_email_auto' ELSE 'domain_email_nidn_auto' END
  );

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'no active university is registered for the domain %', v_domain
      USING ERRCODE = '42501';
  END IF;

  RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lecturer_persona (text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_lecturer_persona (text, uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_lecturer_persona (text, uuid) IS
  'Self-claim the lecturer persona for the university whose institutional_domains contain the caller''s confirmed auth email domain. NIDN is checked for format only when supplied. Never downgrades an existing university_admin; suspended memberships stay suspended. Unofficial claim — revocable by platform admin or that university''s university_admin.';
