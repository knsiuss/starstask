-- Public profile bio for class members.
--
-- `profiles.bio` is deliberately not granted to anon or authenticated. The
-- owner reads and writes it through `get_my_profile()` and `update_my_bio()`,
-- while classmates receive only the bios of members of a class they belong to
-- through `list_class_member_bios()`. That keeps the column out of a global
-- directory query and out of every public assignment response.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_bio_length;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_bio_length CHECK (
  bio IS NULL
  OR char_length(btrim(bio)) BETWEEN 1 AND 280
);

COMMENT ON COLUMN public.profiles.bio IS 'Short self-introduction written by the owner. Readable by classmates through list_class_member_bios(), never granted as a table column.';

-- The owner payload gains `bio`, so the settings form can render the current
-- value without a second request.
CREATE OR REPLACE FUNCTION public.get_my_profile ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET
  search_path = public,
  pg_temp
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_row public.profiles;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles p
  WHERE p.id = v_user;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'fullName', v_row.full_name,
    'nickname', v_row.display_name,
    'nim', v_row.nim,
    'university', v_row.university,
    'declaredClassName', v_row.declared_class_name,
    'avatarUrl', v_row.avatar_url,
    'bio', v_row.bio,
    'onboardedAt', v_row.onboarded_at
  );
END;
$$;

-- The only write path for the bio. An empty value clears it rather than
-- storing whitespace; identity always comes from auth.uid().
CREATE OR REPLACE FUNCTION public.update_my_bio (p_bio TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET
  search_path = public,
  pg_temp
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_bio TEXT := nullif(btrim(coalesce(p_bio, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF v_bio IS NOT NULL AND char_length(v_bio) > 280 THEN
    RAISE EXCEPTION 'invalid bio' USING errcode = '22023';
  END IF;

  UPDATE public.profiles
  SET bio = v_bio
  WHERE id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING errcode = 'P0002';
  END IF;

  RETURN v_bio;
END;
$$;

-- Class-scoped read model: a member can see the bio of the people in the same
-- class, and nobody outside it. Names and avatars keep their existing public
-- profile path; this function returns only ids and bios.
CREATE OR REPLACE FUNCTION public.list_class_member_bios (p_class_id uuid)
RETURNS TABLE (user_id uuid, bio TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET
  search_path = public,
  pg_temp
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF NOT (
    public.is_class_member (p_class_id)
    OR public.is_class_admin (p_class_id)
    OR public.is_platform_admin ()
  ) THEN
    RAISE EXCEPTION 'class access required' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.bio
  FROM public.class_members cm
  JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.class_id = p_class_id
    AND p.bio IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.list_class_member_bios (uuid) IS 'Bios of one class for its members and managers. Gated by class membership, never by a client-supplied user id.';

REVOKE ALL ON FUNCTION public.update_my_bio (TEXT) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.update_my_bio (TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.update_my_bio (TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.list_class_member_bios (uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.list_class_member_bios (uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.list_class_member_bios (uuid) TO authenticated;
