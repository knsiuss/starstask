-- Lecturer persona self-claim (domain_email_nidn_auto).
-- =====================================================================
-- StarsTask remains an unofficial system: this is NOT university approval and
-- NOT proof of NIDN ownership. It grants a narrow `lecturer` membership for the
-- single university whose `institutional_domains` list contains the caller's
-- verified auth email domain, and validates only the NIDN's 10-digit format.
-- Existing university_admin rows are never downgraded or re-claimed here; a
-- platform admin or that university's university_admin can still revoke via
-- set_university_member_role (20270115000000).
--
-- Clients have no INSERT policy on university_memberships by design, so the
-- claim runs as a SECURITY DEFINER function and only creates the row when the
-- caller's own email is confirmed (email_confirmed_at IS NOT NULL).
--
-- Rollback: DROP FUNCTION claim_lecturer_persona(text, uuid);
--           ALTER TABLE universities DROP institutional_domains;
-- =====================================================================
ALTER TABLE public.universities
ADD COLUMN IF NOT EXISTS institutional_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];


-- CHECK constraints cannot reference unnest(); enforce syntax in a trigger.
CREATE OR REPLACE FUNCTION public.universities_validate_institutional_domains () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
DECLARE
  v_invalid integer;
BEGIN
  SELECT count(*)
  INTO v_invalid
  FROM unnest(NEW.institutional_domains) AS d
  WHERE d <> lower(btrim(d))
    OR btrim(d) = ''
    OR btrim(d) !~ '^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$';

  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'institutional_domains must be lowercase exact domains or *. wildcards (e.g. unpam.ac.id)'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS universities_validate_institutional_domains ON public.universities;


CREATE TRIGGER universities_validate_institutional_domains
BEFORE INSERT OR UPDATE OF institutional_domains ON public.universities FOR EACH ROW
EXECUTE FUNCTION public.universities_validate_institutional_domains ();


COMMENT ON COLUMN public.universities.institutional_domains IS 'Lowercase email domains that may auto-claim a lecturer membership at this university (exact match or subdomain when listed as *.example.ac.id). Managed by platform operators; not a proof of employment.';


-- UNPAM is the only seed confirmed so far.
UPDATE public.universities
SET
  institutional_domains = ARRAY['unpam.ac.id', '*.unpam.ac.id']
WHERE
  slug = 'universitas-pamulang'
  AND institutional_domains = ARRAY[]::TEXT[];


-- ---------------------------------------------------------------------------
-- claim_lecturer_persona
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_lecturer_persona (p_nidn text, p_university_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_domain text;
  v_nidn text := btrim(coalesce(p_nidn, ''));
  v_university public.universities;
  v_membership_id uuid;
  v_email_confirmed boolean := false;
  v_match_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_nidn !~ '^[0-9]{10}$' THEN
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

  IF p_university_id IS NULL THEN
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

    SELECT uni.* INTO v_university
    FROM public.universities uni
    WHERE uni.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM unnest(uni.institutional_domains) AS d
        WHERE d = v_domain
          OR (d LIKE '*.%' AND v_domain LIKE '%.' || substr(d, 3))
      );
  ELSE
    SELECT uni.* INTO v_university
    FROM public.universities uni
    WHERE uni.id = p_university_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'university not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_university.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'university is not active' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM unnest(v_university.institutional_domains) AS d
      WHERE d = v_domain
        OR (d LIKE '*.%' AND v_domain LIKE '%.' || substr(d, 3))
    ) THEN
      RAISE EXCEPTION 'your email domain is not registered as institutional for that university'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.university_memberships (
    user_id, university_id, role, status, created_at, updated_at
  ) VALUES (
    v_user, v_university.id, 'lecturer', 'active', now(), now()
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
        updated_at = now()
  RETURNING id INTO v_membership_id;

  PERFORM public.record_audit(
    'lecturer_persona_claimed',
    'university_membership',
    v_membership_id,
    NULL,
    jsonb_build_object(
      'university_id', v_university.id,
      'verification_method', 'domain_email_nidn_auto'
    )
  );

  PERFORM public.enqueue_notification_event(
    v_user,
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


REVOKE ALL ON FUNCTION public.claim_lecturer_persona (text, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.claim_lecturer_persona (text, uuid) TO authenticated;


COMMENT ON FUNCTION public.claim_lecturer_persona (text, uuid) IS 'Self-claim the lecturer persona for the university whose institutional_domains contain the caller''s confirmed auth email domain. NIDN is checked for format only. Never downgrades an existing university_admin; suspended memberships stay suspended. Unofficial claim — revocable by platform admin or that university''s university_admin.';
