-- Phase 5B: academic units + student identities (identity bridge).
--
-- Additive only (expand step of expand-contract, ADR-018). Creates:
--   public.academic_units        flexible per-university org tree (ADR-003)
--   public.student_identities    per-university academic persona details (ADR-001)
--   public.is_university_member  membership predicate used by new RLS policies
--   public.platform_upsert_student_identity
--                                only online write path: platform-admin-gated RPC
--
-- Design basis: phase-4c §09 (units), §11 (student identity), §23 (composite
-- FKs / tenant classes), §26-C + §26-E (target shapes), ADR-001/003/004/013/015.
-- ADR-002 stays PROPOSED at migration time; nothing here activates a
-- university or enforces tenancy on pre-existing tables.
--
-- Compatibility covenant: public.profiles.university / nim columns and the
-- global profiles_nim_unique index are intentionally UNTOUCHED. The legacy
-- NIM is per-account global; student_identities.student_id is per-university.
-- No dual-write is introduced in 5B: onboarding (update_my_profile) keeps
-- writing profiles.nim as before, and new identities are created only via
-- the platform RPC below. Dual-write/contract is a later, separately gated
-- step (see docs/architecture/phase-5b/identity-bridge-implementation.md).
--
-- Membership separation: university_memberships (5A) is the persona bridge
-- (user_id <-> university_id, role, lifecycle status). student_identities
-- carries the academic details for that persona (student_id, entry_year,
-- academic unit, started/graduated timestamps). Not every member is a
-- student: a membership may exist with no identity row. The membership's
-- student_id/entry_year columns from 5A remain legacy mirrors and are NOT
-- written by 5B; the RPC keeps only membership.status in sync.
--
-- Security: both new tables have RLS enabled with no anon access and no
-- client write policies. Writes require service_role or the definer RPC.
CREATE TABLE IF NOT EXISTS public.academic_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  parent_id uuid,
  code text,
  name text NOT NULL,
  unit_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_units_unit_type_length CHECK (char_length(btrim(unit_type)) BETWEEN 1 AND 40),
  CONSTRAINT academic_units_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT academic_units_code_length CHECK (
    code IS NULL
    OR char_length(btrim(code)) BETWEEN 1 AND 40
  ),
  CONSTRAINT academic_units_status_allowed CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT academic_units_no_self_parent CHECK (parent_id IS DISTINCT FROM id)
);


COMMENT ON TABLE public.academic_units IS 'Flexible per-university academic organization tree (ADR-003). Tenant-owned: children stay in the same university via a composite parent FK. Written only by platform operators via service_role; clients can read units of universities where they hold an active membership.';


COMMENT ON COLUMN public.academic_units.parent_id IS 'Parent unit, or NULL for top-level units. Cross-university parents are rejected by the composite FK (parent_id, university_id).';


COMMENT ON COLUMN public.academic_units.code IS 'Short code of the unit (e.g. faculty code). Unique within a university under one parent when present.';


COMMENT ON COLUMN public.academic_units.unit_type IS 'Free-type unit kind; seed values: faculty, department, program, branch, other. Not an enum by design (flexible hierarchy, §09).';


COMMENT ON COLUMN public.academic_units.status IS 'Lifecycle: draft -> active -> archived.';


-- Enables the composite parent FK below (referenced side must be unique).
CREATE UNIQUE INDEX IF NOT EXISTS academic_units_id_university_unique ON public.academic_units (id, university_id);


-- Composite parent FK: a unit's parent must live in the same university.
-- MATCH SIMPLE (default): rows with parent_id IS NULL skip the check.
ALTER TABLE public.academic_units
ADD CONSTRAINT academic_units_parent_same_university FOREIGN KEY (parent_id, university_id) REFERENCES public.academic_units (id, university_id) ON DELETE RESTRICT;


-- Duplicate-code prevention scoped to (university_id, parent_id, code), per
-- §23.3. Postgres treats NULLs as distinct in plain unique constraints, so
-- the parent_id-NULL scope needs its own partial index.
CREATE UNIQUE INDEX IF NOT EXISTS academic_units_code_unique_under_parent ON public.academic_units (university_id, parent_id, lower(btrim(code)))
WHERE
  parent_id IS NOT NULL
  AND code IS NOT NULL;


CREATE UNIQUE INDEX IF NOT EXISTS academic_units_code_unique_top_level ON public.academic_units (university_id, lower(btrim(code)))
WHERE
  parent_id IS NULL
  AND code IS NOT NULL;


CREATE INDEX IF NOT EXISTS academic_units_university_status_idx ON public.academic_units (university_id, status);


CREATE TRIGGER academic_units_set_updated_at
BEFORE UPDATE ON public.academic_units FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- Hierarchy cycle prevention. The composite FK rejects cross-university
-- parents at any depth, but a parent chain that loops back to the row being
-- inserted/updated would satisfy the FK (the parent exists). The trigger
-- walks ancestors from NEW.parent_id; a session-level advisory lock
-- serializes unit-tree writes so two concurrent re-parents cannot race a
-- cycle past the check. The 1000-hop guard bounds pathological chains.
CREATE OR REPLACE FUNCTION public.check_academic_unit_cycle () returns trigger language plpgsql security definer
SET
  search_path = '' AS $$
declare
  v_ancestor uuid;
  v_guard int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'academic unit cannot be its own parent' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('academic_units_cycle_guard')::bigint);
  v_ancestor := new.parent_id;
  while v_ancestor is not null loop
    if v_ancestor = new.id then
      raise exception 'academic unit hierarchy cycle detected' using errcode = '22023';
    end if;
    v_guard := v_guard + 1;
    if v_guard > 1000 then
      raise exception 'academic unit hierarchy too deep' using errcode = '22023';
    end if;
    select
      parent_id into v_ancestor
    from
      public.academic_units
    where
      id = v_ancestor;
  end loop;
  return new;
end;
$$;


COMMENT ON FUNCTION public.check_academic_unit_cycle () IS 'Rejects academic-unit parent chains that loop back to the row being written. Paired with the composite parent FK for cross-university rejection.';


CREATE TRIGGER academic_units_check_cycle
BEFORE INSERT OR UPDATE OF parent_id ON public.academic_units FOR EACH ROW
EXECUTE FUNCTION public.check_academic_unit_cycle ();


-- ---------------------------------------------------------------------------
-- Composite-FK support on the 5A membership table (no column changes).
-- student_identities references (university_membership_id, university_id)
-- so an identity can never be paired with a membership from another
-- university.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS university_memberships_id_university_unique ON public.university_memberships (id, university_id);


-- ---------------------------------------------------------------------------
-- student_identities: the academic face of a university_memberships row
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_membership_id uuid NOT NULL REFERENCES public.university_memberships (id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  academic_unit_id uuid,
  student_id text NOT NULL,
  entry_year int,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  graduated_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One identity row per membership: the identity IS the academic persona.
  CONSTRAINT student_identities_membership_unique UNIQUE (university_membership_id),
  CONSTRAINT student_identities_student_id_format CHECK (student_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'),
  CONSTRAINT student_identities_entry_year_range CHECK (
    entry_year IS NULL
    OR entry_year BETWEEN 1950 AND 2100
  ),
  CONSTRAINT student_identities_status_allowed CHECK (status IN ('pending', 'active', 'suspended', 'graduated')),
  -- Denormalized tenant key must agree with the membership's university.
  CONSTRAINT student_identities_membership_same_university FOREIGN KEY (university_membership_id, university_id) REFERENCES public.university_memberships (id, university_id) ON DELETE CASCADE,
  -- Unit must belong to the same university (MATCH SIMPLE: NULL skips).
  CONSTRAINT student_identities_unit_same_university FOREIGN KEY (academic_unit_id, university_id) REFERENCES public.academic_units (id, university_id) ON DELETE RESTRICT
);


COMMENT ON TABLE public.student_identities IS 'Per-university academic identity for a membership persona (ADR-001). Rows are created/changed only by platform operators via the platform RPC or service_role; clients can read only their own rows. Not every member has one (not every member is a student).';


COMMENT ON COLUMN public.student_identities.university_membership_id IS 'The university_memberships persona this identity describes. One identity per membership (UNIQUE). CASCADE: identity is a pure extension of the membership and dies with it.';


COMMENT ON COLUMN public.student_identities.university_id IS 'Denormalized tenant key, kept consistent with the membership''s university by the composite FK. RESTRICT: a university in use cannot be deleted.';


COMMENT ON COLUMN public.student_identities.academic_unit_id IS 'Program/department unit, or NULL when unassigned. Composite FK rejects units from another university.';


COMMENT ON COLUMN public.student_identities.student_id IS 'Student ID number (NIM) at this university only. Unique within the university (case-insensitive, trimmed), mirroring profiles_nim_unique.';


COMMENT ON COLUMN public.student_identities.entry_year IS 'Entry cohort year (ADR-004). Independent of academic periods (ADR-004 / §10.6): enrolling in a later period never changes it. Nullable in the expand phase; the contract step may tighten to NOT NULL once verified identities always carry one.';


COMMENT ON COLUMN public.student_identities.status IS 'Persona lifecycle: pending -> active -> suspended/graduated. Graduated rows may be reactivated to active by the platform RPC (same row, stable identity); graduated_at is then cleared.';


COMMENT ON COLUMN public.student_identities.started_at IS 'When the identity first became active. Optional repair: set by the platform RPC on first activation.';


COMMENT ON COLUMN public.student_identities.graduated_at IS 'When the identity graduated. Non-null only while status = ''graduated'' in RPC-managed rows; reactivation clears it.';


-- One student_id number per university, case-insensitive and trimmed.
CREATE UNIQUE INDEX IF NOT EXISTS student_identities_student_id_unique ON public.student_identities (university_id, lower(btrim(student_id)));


CREATE INDEX IF NOT EXISTS student_identities_membership_idx ON public.student_identities (university_membership_id);


CREATE UNIQUE INDEX IF NOT EXISTS student_identities_id_university_unique ON public.student_identities (id, university_id);


CREATE TRIGGER student_identities_set_updated_at
BEFORE UPDATE ON public.student_identities FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- is_university_member: active-membership predicate for the new RLS policies.
-- SECURITY DEFINER on purpose (same pattern as is_class_member): the RLS
-- policies call it without querying university_memberships directly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_university_member (p_university_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.university_memberships m
    where
      m.university_id = p_university_id
      and m.status = 'active'
      and m.user_id = (
        select
          auth.uid ()
      )
  );
$$;


COMMENT ON FUNCTION public.is_university_member (uuid) IS 'True when the caller holds an active university_memberships persona at the given university. Used by academic-unit RLS.';


-- ---------------------------------------------------------------------------
-- RLS: read-only for clients. No anon access, no client writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.academic_units ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.academic_units
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.academic_units TO authenticated;


DROP POLICY IF EXISTS academic_units_member_read ON public.academic_units;


CREATE POLICY academic_units_member_read ON public.academic_units FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


ALTER TABLE public.student_identities ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.student_identities
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.student_identities TO authenticated;


DROP POLICY IF EXISTS student_identities_owner_read ON public.student_identities;


CREATE POLICY student_identities_owner_read ON public.student_identities FOR
SELECT
  TO authenticated USING (
    public.is_platform_admin ()
    OR EXISTS (
      SELECT
        1
      FROM
        public.university_memberships m
      WHERE
        m.id = university_membership_id
        AND m.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


-- ---------------------------------------------------------------------------
-- platform_upsert_student_identity: the only online write path.
--
-- Authorization: caller must be a platform admin (is_platform_admin()).
-- The function cannot create platform admins or memberships, so it cannot
-- be used for self-grant or self-admin-assignment.
--
-- Lifecycle transitions are platform-admin decisions, including graduated
-- reactivation: a graduated identity may return to active on the SAME row
-- (stable identity); graduated_at is cleared and started_at is preserved.
-- entry_year is replaced on every call (the RPC is the correction path);
-- audit_logs carries the before/after payload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_upsert_student_identity (
  p_membership_id uuid,
  p_academic_unit_id uuid,
  p_student_id text,
  p_entry_year int,
  p_status text
) returns uuid language plpgsql security definer
SET
  search_path = '' AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_university_id uuid;
  v_identity_id uuid;
  v_student_id text := nullif(btrim(coalesce(p_student_id, '')), '');
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_platform_admin () then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_status is null
  or p_status not in ('pending', 'active', 'suspended', 'graduated') then
    raise exception 'invalid identity status' using errcode = '22023';
  end if;
  if v_student_id is null
  or v_student_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$' then
    raise exception 'invalid student id' using errcode = '22023';
  end if;
  if p_entry_year is not null
  and (
    p_entry_year < 1950
    or p_entry_year > 2100
  ) then
    raise exception 'invalid entry year' using errcode = '22023';
  end if;
  select
    university_id into v_university_id
  from
    public.university_memberships
  where
    id = p_membership_id;
  if v_university_id is null then
    raise exception 'membership not found' using errcode = 'P0002';
  end if;
  if p_academic_unit_id is not null
  and not exists (
    select
      1
    from
      public.academic_units
    where
      id = p_academic_unit_id
      and university_id = v_university_id
  ) then
    raise exception 'academic unit does not belong to the membership university' using errcode = '22023';
  end if;
  insert into public.student_identities (
    university_membership_id,
    university_id,
    academic_unit_id,
    student_id,
    entry_year,
    status,
    started_at,
    graduated_at,
    created_by
  )
  values (
    p_membership_id,
    v_university_id,
    p_academic_unit_id,
    v_student_id,
    p_entry_year,
    p_status,
    case
      when p_status = 'active' then now()
      else null
    end,
    case
      when p_status = 'graduated' then now()
      else null
    end,
    v_actor
  )
  on conflict (university_membership_id) do update
  set
    academic_unit_id = excluded.academic_unit_id,
    student_id = excluded.student_id,
    entry_year = excluded.entry_year,
    status = excluded.status,
    started_at = coalesce(public.student_identities.started_at, excluded.started_at),
    graduated_at = case
      when excluded.status = 'graduated' then now()
      when excluded.status = 'active' then null
      else public.student_identities.graduated_at
    end
  returning
    id into v_identity_id;
  -- Keep the persona lifecycle visible at the membership layer; the
  -- identity is the source of truth for academic fields only.
  update public.university_memberships
  set
    status = p_status
  where
    id = p_membership_id;
  perform public.record_audit(
    'student_identity_upsert',
    'student_identity',
    v_identity_id,
    null,
    jsonb_build_object(
      'actor_id', v_actor,
      'membership_id', p_membership_id,
      'university_id', v_university_id,
      'status', p_status,
      'student_id', v_student_id,
      'entry_year', p_entry_year,
      'academic_unit_id', p_academic_unit_id
    )
  );
  return v_identity_id;
end;
$$;


COMMENT ON FUNCTION public.platform_upsert_student_identity (uuid, uuid, text, int, text) IS 'Platform-admin-only upsert of a student identity for an existing membership. Same-university validation, audit-logged, and mirrors membership status. Cannot grant platform admin or create memberships.';


-- ---------------------------------------------------------------------------
-- Function grants: platform RPC to authenticated only (gated inside);
-- cycle guard is internal (invoked by trigger); predicate to authenticated.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.platform_upsert_student_identity (uuid, uuid, text, int, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.platform_upsert_student_identity (uuid, uuid, text, int, text) TO authenticated;


REVOKE ALL ON FUNCTION public.check_academic_unit_cycle ()
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON FUNCTION public.is_university_member (uuid)
FROM
  public;


GRANT
EXECUTE ON FUNCTION public.is_university_member (uuid) TO authenticated;
