-- Onboarding class creation failed with a 23514 from the audit-log tenant
-- check: create_class_as_student never passed university_id, so the auto-ketua
-- trigger could not scope its roles and its failure-audit insert could not be
-- autofilled. Fix both ends so onboarding cannot be aborted by observability.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_class_as_student(
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_join_policy text DEFAULT 'invitation',
  p_university_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_slug text := lower(btrim(coalesce(p_proposed_slug, '')));
  v_name text := btrim(coalesce(p_proposed_name, ''));
  v_course_name text := btrim(coalesce(p_course_name, ''));
  v_semester text := btrim(coalesce(p_semester, ''));
  v_academic_year text := btrim(coalesce(p_academic_year, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_join_policy text := lower(btrim(coalesce(p_join_policy, 'invitation')));
  v_created_count integer;
  v_course_id uuid;
  v_class_id uuid;
  v_university uuid := p_university_id;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_slug) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'invalid class slug' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_name) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'class name must be 3 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_description) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'description must be 10 to 5000 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_course_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'course name must be 2 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_semester) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'semester must be 1 to 20 characters' USING ERRCODE = '22023';
  END IF;

  IF v_academic_year !~ '^\d{4}/\d{4}$' THEN
    RAISE EXCEPTION 'academic year must look like 2026/2027' USING ERRCODE = '22023';
  END IF;

  IF v_join_policy NOT IN ('invitation', 'open') THEN
    RAISE EXCEPTION 'join policy must be invitation or open' USING ERRCODE = '22023';
  END IF;

  -- Tenant key: prefer the caller's explicit choice, then an active campus
  -- membership, then the free-text university typed during onboarding. Without
  -- this the new class has no tenant and the auto-ketua/audit chain breaks.
  IF v_university IS NULL THEN
    SELECT um.university_id INTO v_university
    FROM public.university_memberships um
    WHERE um.user_id = v_user AND um.status = 'active'
    ORDER BY um.created_at
    LIMIT 1;
  END IF;

  IF v_university IS NULL THEN
    SELECT u.id INTO v_university
    FROM public.profiles p
    JOIN public.universities u
      ON lower(btrim(u.name)) = lower(btrim(p.university))
    WHERE p.id = v_user
    LIMIT 1;
  END IF;

  -- An explicit university choice is a privileged, verified path. A university
  -- derived from the student's own onboarding answer is only a tenant label:
  -- onboarding must not be blocked by a verification step that runs later.
  IF p_university_id IS NOT NULL
     AND NOT public.is_university_member(p_university_id) THEN
    RAISE EXCEPTION 'university membership required for that university' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_lecturer() THEN
    SELECT count(*) INTO v_created_count
    FROM public.classes c
    WHERE c.created_by = v_user AND c.status = 'active';

    IF v_created_count >= 8 THEN
      RAISE EXCEPTION 'self-organized class limit reached (8)' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.classes c WHERE c.slug = v_slug) THEN
    RAISE EXCEPTION 'class slug already taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.courses (name)
  VALUES (v_course_name)
  ON CONFLICT (normalized_name) DO UPDATE SET name = excluded.name
  RETURNING id INTO v_course_id;

  INSERT INTO public.classes (
    slug, name, description, course_id, course_name, lecturer_name,
    semester, academic_year, status, created_by, university_id, join_policy
  ) VALUES (
    v_slug, v_name, v_description, v_course_id, v_course_name,
    NULL, v_semester, v_academic_year, 'active', v_user, v_university, v_join_policy
  ) RETURNING id INTO v_class_id;

  INSERT INTO public.class_members (class_id, user_id, joined_via)
  VALUES (v_class_id, v_user, 'student_created')
  ON CONFLICT (class_id, user_id) DO NOTHING;

  PERFORM public.record_audit(
    'class_created_by_student', 'class', v_class_id, v_class_id,
    jsonb_build_object('slug', v_slug, 'university_id', v_university, 'join_policy', v_join_policy)
  );

  RETURN v_class_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'class already exists' USING ERRCODE = '23505';
END;
$function$;


-- The ketua-grant trigger promised never to abort the membership insert, but
-- its failure audit could raise 23514 from the tenant check and roll back the
-- whole class creation. Observability must stay best-effort here.
CREATE OR REPLACE FUNCTION public.maybe_grant_ketua_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_university uuid;
  v_is_elevated boolean := false;
BEGIN
  IF NEW.joined_via IN ('lecturer_assignment', 'admin_assignment', 'platform_assignment') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.class_ketua_assignments WHERE class_id = NEW.class_id AND revoked_at IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT university_id INTO v_university FROM public.classes WHERE id = NEW.class_id;

  SELECT
    public.is_platform_admin()
    OR (
      v_university IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.university_memberships m
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

  PERFORM 1 FROM public.classes c WHERE c.id = NEW.class_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.class_ketua_assignments WHERE class_id = NEW.class_id AND revoked_at IS NULL) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.grant_ketua_kelas(NEW.class_id, NEW.user_id, 'auto_first_join');
    PERFORM public.record_audit(
      'ketua_kelas_auto_granted', 'class_ketua_assignment', NEW.class_id, NEW.class_id,
      jsonb_build_object('user_id', NEW.user_id, 'source', 'auto_first_join')
    );
  EXCEPTION WHEN OTHERS THEN
    DECLARE
      v_failure_code text := SQLSTATE;
    BEGIN
      BEGIN
        PERFORM public.record_audit(
          'ketua_kelas_auto_grant_failed', 'class_member', NEW.class_id, NEW.class_id,
          jsonb_build_object('user_id', NEW.user_id, 'error_code', v_failure_code)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- audit is best-effort; it must not abort the membership insert
      END;
    END;
  END;

  RETURN NEW;
END;
$function$;
