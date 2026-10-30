-- Minimal profile onboarding, NIM privacy, and class-name auto-matching.
--
-- Three concerns share this migration because they all hang off `profiles`:
--
--   profiles        consent-collected identity: legal name, nickname, NIM,
--                   university, the class text the student typed, and the
--                   completion timestamp that gates the workspace.
--   classes         join_policy finally makes "a class that may be joined by
--                   name" representable; the default keeps every existing class
--                   invitation-only, so nothing changes until an operator opts
--                   a class in.
--   join_class_by_name  the one write path that turns a typed class name into an
--                   ordinary membership, and only under that policy.
--
-- Privacy rule for `profiles`: `full_name` and `nim` are never granted to anon
-- or authenticated. They exist on the row, but PostgREST cannot select them and
-- a client cannot write them. The owner reaches them only through the
-- SECURITY DEFINER functions below, which re-derive identity from auth.uid().
-- ---------------------------------------------------------------------------
-- profiles: onboarding columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name text;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nim text;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS university text;


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS declared_class_name text;


-- NULL means onboarding is not finished. It is only ever set by
-- update_my_profile() after every required value has been validated and written,
-- so it can never be true of a half-saved profile.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;


ALTER TABLE public.profiles
DROP CONSTRAINT if EXISTS profiles_full_name_length;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_full_name_length CHECK (
  full_name IS NULL
  OR char_length(btrim(full_name)) BETWEEN 2 AND 80
);


-- A conservative format check, not a university-specific rule: digits, letters,
-- dot, underscore, and hyphen. Leading zeros are preserved by the text type.
ALTER TABLE public.profiles
DROP CONSTRAINT if EXISTS profiles_nim_format;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_nim_format CHECK (
  nim IS NULL
  OR nim ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'
);


ALTER TABLE public.profiles
DROP CONSTRAINT if EXISTS profiles_university_length;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_university_length CHECK (
  university IS NULL
  OR char_length(btrim(university)) BETWEEN 2 AND 120
);


ALTER TABLE public.profiles
DROP CONSTRAINT if EXISTS profiles_declared_class_length;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_declared_class_length CHECK (
  declared_class_name IS NULL
  OR char_length(btrim(declared_class_name)) BETWEEN 1 AND 60
);


COMMENT ON COLUMN public.profiles.full_name IS 'Legal name collected during onboarding. Private: never granted to clients, never shown publicly.';


COMMENT ON COLUMN public.profiles.nim IS 'Student ID. Sensitive: no column grant to anon/authenticated, so it cannot be selected through PostgREST.';


COMMENT ON COLUMN public.profiles.university IS 'Free-text university, trimmed. Collected, not verified.';


COMMENT ON COLUMN public.profiles.declared_class_name IS 'The class text the student typed, kept even when it matched no registered class.';


COMMENT ON COLUMN public.profiles.onboarded_at IS 'Set by update_my_profile() once required values are persisted. NULL means onboarding is incomplete.';


COMMENT ON COLUMN public.profiles.display_name IS 'Public display name. Onboarding writes the student''s nickname here, so every existing public query keeps showing the nickname rather than the legal name.';


-- The workspace gate reads `onboarded_at` with the user's own session, so it
-- needs a column grant. It is a timestamp, not personal data.
GRANT
SELECT
  (onboarded_at) ON public.profiles TO authenticated;


-- ---------------------------------------------------------------------------
-- handle_new_user: also capture the legal name from Google
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user () returns trigger language plpgsql security definer
SET
  search_path = '' AS $$
declare v_display_name text;
v_full_name text;
v_avatar_url text;
begin v_display_name := coalesce(
  nullif(
    btrim(new.raw_user_meta_data->>'full_name'),
    ''
  ),
  nullif(btrim(new.raw_user_meta_data->>'name'), ''),
  nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
  'StarsTask member'
);
v_full_name := coalesce(
  nullif(
    btrim(new.raw_user_meta_data->>'full_name'),
    ''
  ),
  nullif(btrim(new.raw_user_meta_data->>'name'), '')
);
v_avatar_url := coalesce(
  nullif(
    btrim(new.raw_user_meta_data->>'avatar_url'),
    ''
  ),
  nullif(btrim(new.raw_user_meta_data->>'picture'), '')
);
-- Only https avatars are accepted; anything else is dropped instead of
-- failing the signup transaction.
if v_avatar_url is not null
and v_avatar_url not like 'https://%' then v_avatar_url := null;
end if;
insert into public.profiles (id, display_name, full_name, avatar_url)
values (
    new.id,
    left(v_display_name, 80),
    left(v_full_name, 80),
    left(v_avatar_url, 2048)
  ) on conflict (id) do nothing;
return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Class name normalization
-- ---------------------------------------------------------------------------
-- The single definition of "same class name", used for both the student's typed
-- input and the stored class identifiers. Lowercase, then drop everything that
-- is not a letter or digit, so case, spacing, and separators stop mattering
-- while genuinely different identifiers stay different:
--
--   'IF-24-01', ' if-24-01 ', 'IF 24 01' -> 'if2401'
--   'IF-24-1'                            -> 'if241'   (a different class)
--
-- `btrim` is kept even though everything is stripped afterwards so that a value
-- made only of separators normalizes to NULL rather than to an empty string.
CREATE OR REPLACE FUNCTION public.normalize_class_key (p_value text) returns text language sql stable
SET
  search_path = '' AS $$
select
  nullif(
    regexp_replace(lower(btrim(coalesce(p_value, ''))), '[^a-z0-9]', '', 'g'),
    ''
  );
$$;


-- ---------------------------------------------------------------------------
-- classes.join_policy: is this class joinable by name?
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'invitation';


ALTER TABLE public.classes
DROP CONSTRAINT if EXISTS classes_join_policy_allowed;


ALTER TABLE public.classes
ADD CONSTRAINT classes_join_policy_allowed CHECK (join_policy IN ('invitation', 'open'));


COMMENT ON COLUMN public.classes.join_policy IS 'invitation = membership only through an invitation link (default). open = a matching typed class name may be joined automatically.';


-- A membership created by name matching is a distinct provenance and must be
-- allowed by the existing check constraint.
ALTER TABLE public.class_members
DROP CONSTRAINT if EXISTS class_members_joined_via_allowed;


ALTER TABLE public.class_members
ADD CONSTRAINT class_members_joined_via_allowed CHECK (
  joined_via IN (
    'invitation',
    'admin_assignment',
    'platform_assignment',
    'name_match'
  )
);


-- ---------------------------------------------------------------------------
-- get_my_profile: the owner's own onboarding state, including private columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile () returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_user uuid := (
  select auth.uid ()
);
v_row public.profiles;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
select * into v_row
from public.profiles p
where p.id = v_user;
if not found then return null;
end if;
return jsonb_build_object(
  'id', v_row.id,
  'fullName', v_row.full_name,
  'nickname', v_row.display_name,
  'nim', v_row.nim,
  'university', v_row.university,
  'declaredClassName', v_row.declared_class_name,
  'avatarUrl', v_row.avatar_url,
  'onboardedAt', v_row.onboarded_at
);
end;
$$;


-- ---------------------------------------------------------------------------
-- update_my_profile: validate and persist the onboarding form
-- ---------------------------------------------------------------------------
-- Required values are full name, nickname, NIM, and university. The class text
-- is optional: an unmatched or missing class still allows a complete profile,
-- and the raw text is kept so the student does not lose what they typed.
CREATE OR REPLACE FUNCTION public.update_my_profile (
  p_full_name text,
  p_nickname text,
  p_nim text,
  p_university text,
  p_declared_class text DEFAULT NULL
) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_user uuid := (
  select auth.uid ()
);
v_full text := nullif(btrim(coalesce(p_full_name, '')), '');
v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
v_nim text := nullif(btrim(coalesce(p_nim, '')), '');
v_uni text := nullif(btrim(coalesce(p_university, '')), '');
v_class text := nullif(btrim(coalesce(p_declared_class, '')), '');
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
if v_full is null
or char_length(v_full) < 2
or char_length(v_full) > 80 then raise exception 'invalid full name' using errcode = '22023';
end if;
if v_nick is null
or char_length(v_nick) < 2
or char_length(v_nick) > 60 then raise exception 'invalid nickname' using errcode = '22023';
end if;
if v_nim is null
or v_nim !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$' then raise exception 'invalid NIM' using errcode = '22023';
end if;
if v_uni is null
or char_length(v_uni) < 2
or char_length(v_uni) > 120 then raise exception 'invalid university' using errcode = '22023';
end if;
if v_class is not null
and char_length(v_class) > 60 then raise exception 'invalid class name' using errcode = '22023';
end if;
update public.profiles
set
  full_name = v_full,
  display_name = v_nick,
  nim = v_nim,
  university = v_uni,
  declared_class_name = v_class,
  -- Keep the first completion timestamp; re-saving must not move it.
  onboarded_at = coalesce(onboarded_at, now())
where id = v_user;
if not found then raise exception 'profile not found' using errcode = 'P0002';
end if;
return public.get_my_profile();
end;
$$;


-- ---------------------------------------------------------------------------
-- set_my_avatar_url: the photo upload path writes only this column
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_avatar_url (p_avatar_url text) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_user uuid := (
  select auth.uid ()
);
v_url text := nullif(btrim(coalesce(p_avatar_url, '')), '');
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
if v_url is not null
and v_url not like 'https://%' then raise exception 'invalid avatar url' using errcode = '22023';
end if;
update public.profiles
set
  avatar_url = v_url
where id = v_user;
if not found then raise exception 'profile not found' using errcode = 'P0002';
end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- join_class_by_name: normalize -> match -> ordinary membership, or a clear
-- reason it did not happen
-- ---------------------------------------------------------------------------
-- Returns one of:
--   { "status": "no_match" }
--   { "status": "ambiguous", "candidates": [ { id, slug, name } ] }
--   { "status": "already_member",   classId, slug, name }
--   { "status": "blocked_by_policy", classId, slug, name }
--   { "status": "joined",            classId, slug, name }
--
-- Only active classes are considered. Only join_policy = 'open' joins. The
-- function never touches class_admins, so a match can never grant a role.
CREATE OR REPLACE FUNCTION public.join_class_by_name (p_class_name text) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_user uuid := (
  select auth.uid ()
);
v_key text;
v_matches public.classes[];
v_class public.classes;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
v_key := public.normalize_class_key(p_class_name);
if v_key is null then return jsonb_build_object('status', 'no_match');
end if;
select array_agg(c order by c.id) into v_matches
from public.classes c
where c.status = 'active'
  and (
    public.normalize_class_key(c.slug) = v_key
    or public.normalize_class_key(c.name) = v_key
  );
if v_matches is null
or array_length(v_matches, 1) = 0 then return jsonb_build_object('status', 'no_match');
end if;
if array_length(v_matches, 1) > 1 then return jsonb_build_object(
  'status',
  'ambiguous',
  'candidates',
  (
    select jsonb_agg(
        jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name) order by c.name
      )
    from unnest(v_matches) as c
  )
);
end if;
v_class := v_matches[1];
-- An existing member always gets the class back, before any policy check, so a
-- retry or a re-submit is a no-op rather than an error.
if exists (
  select
    1
  from
    public.class_members m
  where
    m.class_id = v_class.id
    and m.user_id = v_user
) then return jsonb_build_object(
  'status',
  'already_member',
  'classId',
  v_class.id,
  'slug',
  v_class.slug,
  'name',
  v_class.name
);
end if;
if v_class.join_policy <> 'open' then return jsonb_build_object(
  'status',
  'blocked_by_policy',
  'classId',
  v_class.id,
  'slug',
  v_class.slug,
  'name',
  v_class.name
);
end if;
insert into public.class_members (class_id, user_id, joined_via)
values (v_class.id, v_user, 'name_match') on conflict (class_id, user_id) do nothing;
perform public.record_audit(
  'class_member_joined_by_name',
  'class_member',
  v_user,
  v_class.id,
  jsonb_build_object('slug', v_class.slug)
);
return jsonb_build_object(
  'status',
  'joined',
  'classId',
  v_class.id,
  'slug',
  v_class.slug,
  'name',
  v_class.name
);
end;
$$;


-- ---------------------------------------------------------------------------
-- Function grants: authenticated only, never anon
-- ---------------------------------------------------------------------------
REVOKE ALL ON function public.get_my_profile ()
FROM
  public;


GRANT
EXECUTE ON function public.get_my_profile () TO authenticated;


REVOKE ALL ON function public.update_my_profile (text, text, text, text, text)
FROM
  public;


GRANT
EXECUTE ON function public.update_my_profile (text, text, text, text, text) TO authenticated;


REVOKE ALL ON function public.set_my_avatar_url (text)
FROM
  public;


GRANT
EXECUTE ON function public.set_my_avatar_url (text) TO authenticated;


REVOKE ALL ON function public.join_class_by_name (text)
FROM
  public;


GRANT
EXECUTE ON function public.join_class_by_name (text) TO authenticated;


REVOKE ALL ON function public.normalize_class_key (text)
FROM
  public;


GRANT
EXECUTE ON function public.normalize_class_key (text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Storage: public avatars bucket, owner-scoped writes
-- ---------------------------------------------------------------------------
-- Object key convention: {owner_id}/{uuid}-{safe_filename}. The bucket is
-- public because the avatar URL is already public contributor metadata, so an
-- <img> can point at it without a signed-URL round trip.
INSERT INTO
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    TRUE,
    2097152,
    ARRAY['image/png', 'image/jpeg']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


DROP POLICY if EXISTS avatars_storage_read ON storage.objects;


CREATE POLICY avatars_storage_read ON storage.objects FOR
SELECT
  TO anon,
  authenticated USING (bucket_id = 'avatars');


DROP POLICY if EXISTS avatars_storage_insert ON storage.objects;


CREATE POLICY avatars_storage_insert ON storage.objects FOR insert TO authenticated
WITH
  CHECK (
    bucket_id = 'avatars'
    AND (
      SELECT
        auth.uid ()
    )::text = (storage.foldername (name)) [1]
  );


DROP POLICY if EXISTS avatars_storage_update ON storage.objects;


CREATE POLICY avatars_storage_update ON storage.objects
FOR UPDATE
  TO authenticated USING (
    bucket_id = 'avatars'
    AND (
      SELECT
        auth.uid ()
    )::text = (storage.foldername (name)) [1]
  )
WITH
  CHECK (
    bucket_id = 'avatars'
    AND (
      SELECT
        auth.uid ()
    )::text = (storage.foldername (name)) [1]
  );


DROP POLICY if EXISTS avatars_storage_delete ON storage.objects;


CREATE POLICY avatars_storage_delete ON storage.objects FOR delete TO authenticated USING (
  bucket_id = 'avatars'
  AND (
    SELECT
      auth.uid ()
  )::text = (storage.foldername (name)) [1]
);
