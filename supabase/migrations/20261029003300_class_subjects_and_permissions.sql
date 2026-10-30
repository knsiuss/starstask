-- Class Group Architecture, Subjects, and Member Permissions.
--
-- Tables added:
--   class_subjects                subjects/courses created within a main class group
--   class_invitation_declines     user declines for invitations to prevent re-prompting
--
-- Columns added:
--   assignments.subject_id        links an assignment to a specific subject inside a class

-- ---------------------------------------------------------------------------
-- class_subjects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  description text,
  lecturer_name text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_subjects_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT class_subjects_code_length CHECK (
    code IS NULL
    OR char_length(btrim(code)) BETWEEN 1 AND 20
  ),
  CONSTRAINT class_subjects_description_length CHECK (
    description IS NULL
    OR char_length(btrim(description)) BETWEEN 3 AND 2000
  ),
  CONSTRAINT class_subjects_lecturer_length CHECK (
    lecturer_name IS NULL
    OR char_length(btrim(lecturer_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT class_subjects_status_allowed CHECK (status IN ('active', 'archived'))
);

COMMENT ON TABLE public.class_subjects IS 'Subjects/courses created within a main class group. Inherits membership from the parent class.';

CREATE INDEX IF NOT EXISTS class_subjects_class_idx ON public.class_subjects (class_id, created_at ASC);

CREATE INDEX IF NOT EXISTS class_subjects_course_idx ON public.class_subjects (course_id);

CREATE TRIGGER class_subjects_set_updated_at
BEFORE UPDATE ON public.class_subjects FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- assignments.subject_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.class_subjects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assignments_subject_idx ON public.assignments (subject_id)
WHERE
  subject_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seed initial subject for existing classes
-- ---------------------------------------------------------------------------
INSERT INTO public.class_subjects (class_id, course_id, name, lecturer_name, status, created_at, updated_at)
SELECT
  c.id,
  c.course_id,
  c.course_name,
  c.lecturer_name,
  c.status,
  c.created_at,
  c.updated_at
FROM
  public.classes c
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.class_subjects cs
    WHERE
      cs.class_id = c.id
  );

UPDATE public.assignments a
SET
  subject_id = cs.id
FROM
  public.class_subjects cs
WHERE
  a.class_id = cs.class_id
  AND a.course_id = cs.course_id
  AND a.subject_id IS NULL;

-- ---------------------------------------------------------------------------
-- class_invitation_declines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_invitation_declines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.class_invitations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  declined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_invitation_declines_key UNIQUE (invitation_id, user_id)
);

COMMENT ON TABLE public.class_invitation_declines IS 'Records when a user declines a pending invitation so it is removed from their dashboard.';

CREATE INDEX IF NOT EXISTS class_invitation_declines_user_idx ON public.class_invitation_declines (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_invitation_declines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.class_subjects FROM anon, authenticated;
REVOKE ALL ON public.class_invitation_declines FROM anon, authenticated;

GRANT SELECT ON public.class_subjects TO anon;
GRANT SELECT, INSERT, UPDATE ON public.class_subjects TO authenticated;

GRANT SELECT, INSERT ON public.class_invitation_declines TO authenticated;

-- class_subjects policies
DROP POLICY IF EXISTS class_subjects_public_read ON public.class_subjects;
CREATE POLICY class_subjects_public_read ON public.class_subjects FOR
SELECT
  TO anon USING (
    status = 'active'
    AND EXISTS (
      SELECT
        1
      FROM
        public.classes c
      WHERE
        c.id = class_id
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS class_subjects_authenticated_read ON public.class_subjects;
CREATE POLICY class_subjects_authenticated_read ON public.class_subjects FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
    OR (
      status = 'active'
      AND EXISTS (
        SELECT
          1
        FROM
          public.classes c
        WHERE
          c.id = class_id
          AND c.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS class_subjects_manage_insert ON public.class_subjects;
CREATE POLICY class_subjects_manage_insert ON public.class_subjects FOR
INSERT
  TO authenticated WITH CHECK (public.can_manage_class (class_id));

DROP POLICY IF EXISTS class_subjects_manage_update ON public.class_subjects;
CREATE POLICY class_subjects_manage_update ON public.class_subjects FOR
UPDATE TO authenticated USING (public.can_manage_class (class_id))
WITH CHECK (public.can_manage_class (class_id));

-- class_invitation_declines policies
DROP POLICY IF EXISTS class_invitation_declines_user_read ON public.class_invitation_declines;
CREATE POLICY class_invitation_declines_user_read ON public.class_invitation_declines FOR
SELECT
  TO authenticated USING (user_id = auth.uid ());

DROP POLICY IF EXISTS class_invitation_declines_user_insert ON public.class_invitation_declines;
CREATE POLICY class_invitation_declines_user_insert ON public.class_invitation_declines FOR
INSERT
  TO authenticated WITH CHECK (user_id = auth.uid ());

-- ---------------------------------------------------------------------------
-- Subject Management Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_class_subject (
  p_class_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_course_id uuid;
  v_subject_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF NOT public.can_manage_class(p_class_id) THEN
    RAISE EXCEPTION 'class admin permissions required' USING errcode = '42501';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) < 2 OR char_length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'invalid subject name' USING errcode = '22023';
  END IF;

  -- Ensure course entry exists in public.courses
  INSERT INTO public.courses (name, code)
  VALUES (btrim(p_name), nullif(btrim(coalesce(p_code, '')), ''))
  ON CONFLICT (normalized_name)
  DO UPDATE SET
    code = coalesce(public.courses.code, excluded.code)
  RETURNING id INTO v_course_id;

  INSERT INTO public.class_subjects (
    class_id,
    course_id,
    name,
    code,
    description,
    lecturer_name,
    status,
    created_by
  )
  VALUES (
    p_class_id,
    v_course_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_code, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_lecturer_name, '')), ''),
    'active',
    v_user
  )
  RETURNING id INTO v_subject_id;

  PERFORM public.record_audit(
    'class_subject_created',
    'class_subject',
    v_subject_id,
    p_class_id,
    jsonb_build_object('name', btrim(p_name))
  );

  RETURN v_subject_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_class_subject (
  p_subject_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_status text DEFAULT 'active'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_subject public.class_subjects;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_subject FROM public.class_subjects WHERE id = p_subject_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject not found' USING errcode = 'P0002';
  END IF;

  IF NOT public.can_manage_class(v_subject.class_id) THEN
    RAISE EXCEPTION 'class admin permissions required' USING errcode = '42501';
  END IF;

  IF p_name IS NOT NULL AND (char_length(btrim(p_name)) < 2 OR char_length(btrim(p_name)) > 120) THEN
    RAISE EXCEPTION 'invalid subject name' USING errcode = '22023';
  END IF;

  IF p_status NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'invalid status' USING errcode = '22023';
  END IF;

  UPDATE public.class_subjects
  SET
    name = coalesce(nullif(btrim(p_name), ''), name),
    code = coalesce(nullif(btrim(p_code), ''), code),
    description = p_description,
    lecturer_name = p_lecturer_name,
    status = coalesce(p_status, status),
    updated_at = now()
  WHERE
    id = p_subject_id;

  PERFORM public.record_audit(
    'class_subject_updated',
    'class_subject',
    p_subject_id,
    v_subject.class_id,
    jsonb_build_object('status', p_status)
  );

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Invitation Preview Function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_preview (p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_hash text;
  v_inv public.class_invitations;
  v_class public.classes;
  v_admin_name text;
  v_is_member boolean := false;
  v_is_valid boolean := true;
  v_invalid_reason text := null;
  v_user_email text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 20 OR char_length(p_token) > 200 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_token');
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv FROM public.class_invitations WHERE token_hash = v_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_class FROM public.classes WHERE id = v_inv.class_id;
  IF NOT FOUND OR v_class.status <> 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'class_not_active');
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.class_members WHERE class_id = v_inv.class_id AND user_id = v_user
    ) INTO v_is_member;

    IF v_inv.email_restriction IS NOT NULL THEN
      SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user;
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
    'inviter_name', coalesce(v_admin_name, 'Class Admin'),
    'expires_at', v_inv.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_class_subject (uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_class_subject (uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview (text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Accept and Decline Pending Invitations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_pending_invitation (p_invitation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_inv public.class_invitations;
  v_email text;
  v_class_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.class_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING errcode = 'P0002';
  END IF;

  -- Idempotent check: if already a member, return class_id without failing or consuming a use
  IF EXISTS (
    SELECT 1 FROM public.class_members WHERE class_id = v_inv.class_id AND user_id = v_user
  ) THEN
    RETURN v_inv.class_id;
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

  INSERT INTO public.class_members (class_id, user_id, joined_via)
  VALUES (v_inv.class_id, v_user, 'invitation');

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
    '{}'::jsonb
  );

  RETURN v_inv.class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_class_invitation (p_invitation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  INSERT INTO public.class_invitation_declines (invitation_id, user_id)
  VALUES (p_invitation_id, v_user)
  ON CONFLICT (invitation_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_pending_invitation (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_class_invitation (uuid) TO authenticated;

