-- Phase 5A: university registry + membership foundation.
--
-- Additive only. Creates:
--   public.universities           platform-controlled tenant registry
--   public.university_memberships user_id -> auth.users bridge for
--                                 per-university academic personas
--
-- Design basis: phase-4c §26-B (universities) + §26-E (student identity),
-- ADR-001 (one global account, APPROVED), ADR-004 (Entry Year, APPROVED).
-- ADR-002 (single-table registry) remains PROPOSED: this migration builds
-- the table but nothing activates, backfills, or enforces tenancy yet.
--
-- Compatibility covenant: public.profiles.university / nim free-text columns
-- are intentionally UNTOUCHED. The fuzzy university-string mapping cannot be
-- automated (phase-4c §30.3, open question 7) and no membership rows are
-- backfilled here. Existing onboarding (update_my_profile) is unaffected.
--
-- Security: both tables have RLS enabled with no anon access. Authenticated
-- users may only READ active universities and their own membership rows.
-- All writes require service_role (platform admin path); there is no client
-- write policy, so self-granting a membership is impossible from PostgREST.
CREATE TABLE IF NOT EXISTS public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  code text,
  name text NOT NULL,
  short_name text,
  type text,
  country text,
  province text,
  city text,
  website text,
  logo_url text,
  timezone text,
  locale text,
  status text NOT NULL DEFAULT 'registered',
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT universities_slug_unique UNIQUE (slug),
  CONSTRAINT universities_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT universities_slug_length CHECK (char_length(btrim(slug)) BETWEEN 2 AND 80),
  CONSTRAINT universities_code_length CHECK (
    code IS NULL
    OR char_length(btrim(code)) BETWEEN 1 AND 40
  ),
  CONSTRAINT universities_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT universities_short_name_length CHECK (
    short_name IS NULL
    OR char_length(btrim(short_name)) BETWEEN 1 AND 80
  ),
  CONSTRAINT universities_type_length CHECK (
    type IS NULL
    OR char_length(btrim(type)) BETWEEN 1 AND 40
  ),
  CONSTRAINT universities_website_https CHECK (
    website IS NULL
    OR website LIKE 'https://%'
  ),
  CONSTRAINT universities_logo_https CHECK (
    logo_url IS NULL
    OR logo_url LIKE 'https://%'
  ),
  CONSTRAINT universities_status_allowed CHECK (
    status IN ('registered', 'pending', 'active', 'suspended', 'inactive')
  ),
  CONSTRAINT universities_created_by_fk FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL
);


COMMENT ON TABLE public.universities IS 'Platform-controlled university registry and tenant root. Rows are created/activated only by platform operators via service_role; clients can read active rows only.';


COMMENT ON COLUMN public.universities.slug IS 'Stable URL-safe identifier, unique. One per university, never reused.';


COMMENT ON COLUMN public.universities.code IS 'Official institution code when known (e.g. Kemendikbudristek code). Unique when present.';


COMMENT ON COLUMN public.universities.name IS 'Official name as registered.';


COMMENT ON COLUMN public.universities.status IS 'Lifecycle: registered -> pending -> active -> suspended/inactive.';


COMMENT ON COLUMN public.universities.activated_at IS 'When the university was activated by a platform admin.';


COMMENT ON COLUMN public.universities.deactivated_at IS 'When the university was last suspended or deactivated.';


COMMENT ON COLUMN public.universities.created_by IS 'Platform admin who created the row, if known.';


CREATE UNIQUE INDEX IF NOT EXISTS universities_code_unique ON public.universities (lower(btrim(code)))
WHERE
  code IS NOT NULL;


CREATE INDEX IF NOT EXISTS universities_status_idx ON public.universities (status);


CREATE TRIGGER universities_set_updated_at
BEFORE UPDATE ON public.universities FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- university_memberships: one global account, many university personas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.university_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  student_id text,
  role text NOT NULL DEFAULT 'student',
  entry_year int,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT university_memberships_user_university_unique UNIQUE (user_id, university_id),
  CONSTRAINT university_memberships_student_id_format CHECK (
    student_id IS NULL
    OR student_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'
  ),
  CONSTRAINT university_memberships_role_length CHECK (char_length(btrim(role)) BETWEEN 1 AND 40),
  CONSTRAINT university_memberships_entry_year_range CHECK (
    entry_year IS NULL
    OR entry_year BETWEEN 1950 AND 2100
  ),
  CONSTRAINT university_memberships_status_allowed CHECK (status IN ('pending', 'active', 'suspended', 'graduated'))
);


COMMENT ON TABLE public.university_memberships IS 'Per-university academic persona for a global account (ADR-001). Rows are created only by platform operators via service_role; clients can read only their own rows.';


COMMENT ON COLUMN public.university_memberships.user_id IS 'Global account id (auth.users).';


COMMENT ON COLUMN public.university_memberships.university_id IS 'Tenant this persona belongs to. Restrict: a university with memberships cannot be deleted.';


COMMENT ON COLUMN public.university_memberships.student_id IS 'Student ID number (NIM) at this university only. Unique within the university.';


COMMENT ON COLUMN public.university_memberships.role IS 'Membership role. Values are extensible (open question 4); only student is assigned in 5A.';


COMMENT ON COLUMN public.university_memberships.entry_year IS 'Entry cohort year (ADR-004). Immutable post-activation in the target design.';


COMMENT ON COLUMN public.university_memberships.status IS 'Persona lifecycle: pending -> active -> suspended/graduated.';


-- One student_id number may belong to exactly one persona per university.
-- Partial index mirrors profiles_nim_unique: rows without a student id are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS university_memberships_student_id_unique ON public.university_memberships (university_id, lower(btrim(student_id)))
WHERE
  student_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS university_memberships_user_idx ON public.university_memberships (user_id);


CREATE INDEX IF NOT EXISTS university_memberships_university_status_idx ON public.university_memberships (university_id, status);


CREATE TRIGGER university_memberships_set_updated_at
BEFORE UPDATE ON public.university_memberships FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- RLS: read-only for clients. No anon access, no client writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.universities
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.universities TO authenticated;


DROP POLICY IF EXISTS universities_active_read ON public.universities;


CREATE POLICY universities_active_read ON public.universities FOR
SELECT
  TO authenticated USING (status = 'active');


ALTER TABLE public.university_memberships ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.university_memberships
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.university_memberships TO authenticated;


DROP POLICY IF EXISTS university_memberships_owner_read ON public.university_memberships;


CREATE POLICY university_memberships_owner_read ON public.university_memberships FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );
