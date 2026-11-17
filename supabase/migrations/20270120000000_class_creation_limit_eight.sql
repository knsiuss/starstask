-- ---------------------------------------------------------------------------
-- Class creation limit: 8 active self-organized classes per person.
--
-- The previous abuse guard allowed 3, which is too tight for a student who
-- keeps a class per course plus group work. Lecturers are exempt because the
-- number of classes they teach is set by their institution, not by an abuse
-- guard. The lecturer persona includes university_admin, the same predicate
-- every other lecturer surface uses.
--
-- Everything else is unchanged from 20270117000000: the creator becomes ketua
-- through the class_members trigger, and the returned id is the new class.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_class_as_student (
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_join_policy text DEFAULT 'invitation',
  p_university_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
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

  IF p_university_id IS NOT NULL
     AND NOT public.is_university_member(p_university_id) THEN
    RAISE EXCEPTION 'university membership required for that university' USING ERRCODE = '42501';
  END IF;

  -- Abuse guard: at most 8 active self-organized classes. Lecturers are not
  -- capped; their teaching load is an institutional decision.
  IF NOT public.is_lecturer () THEN
    SELECT count(*)
    INTO v_created_count
    FROM public.classes c
    WHERE c.created_by = v_user
      AND c.status = 'active';

    IF v_created_count >= 8 THEN
      RAISE EXCEPTION 'self-organized class limit reached (8)' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.classes c WHERE c.slug = v_slug) THEN
    RAISE EXCEPTION 'class slug already taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.courses (name)
  VALUES (v_course_name)
  ON CONFLICT (normalized_name) DO UPDATE
  SET name = excluded.name
  RETURNING id INTO v_course_id;

  INSERT INTO public.classes (
    slug, name, description, course_id, course_name, lecturer_name,
    semester, academic_year, status, created_by, university_id, join_policy
  ) VALUES (
    v_slug, v_name, v_description, v_course_id, v_course_name,
    NULL, v_semester, v_academic_year, 'active', v_user, p_university_id, v_join_policy
  ) RETURNING id INTO v_class_id;

  INSERT INTO public.class_members (class_id, user_id, joined_via)
  VALUES (v_class_id, v_user, 'student_created')
  ON CONFLICT (class_id, user_id) DO NOTHING;

  PERFORM public.record_audit(
    'class_created_by_student',
    'class',
    v_class_id,
    v_class_id,
    jsonb_build_object('slug', v_slug, 'university_id', p_university_id, 'join_policy', v_join_policy)
  );

  RETURN v_class_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'class already exists' USING ERRCODE = '23505';
END;
$$;


REVOKE ALL ON FUNCTION public.create_class_as_student (text, text, text, text, text, text, text, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.create_class_as_student (text, text, text, text, text, text, text, uuid) TO authenticated;


COMMENT ON FUNCTION public.create_class_as_student (text, text, text, text, text, text, text, uuid) IS 'Self-organized class for any signed-in user. Creator becomes ketua via the class_members trigger. Abuse guard: at most 8 active self-organized classes per person; lecturers and university admins are exempt. Join policy selectable (invitation default).';
