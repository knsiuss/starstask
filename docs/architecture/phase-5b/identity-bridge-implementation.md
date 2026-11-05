# Phase 5B — Identity Bridge Implementation

> Decisions in `decision-register.md`; validation in
> `migration-validation-report.md`; findings in `evidence-closure.md`.

## 1. What changed

- **New migration (additive only):**
  `supabase/migrations/20261112000000_identity_bridge.sql`
- **New docs:** `docs/architecture/phase-5b/{evidence-closure,decision-register,identity-bridge-implementation,migration-validation-report}.md`
- **Hand-maintained types (required by the contract check):**
  `apps/web/src/types/database.ts` — added `academic_units` and
  `student_identities` tables (Row/Insert/Update/Relationships).
- **Regenerated types:**
  `apps/web/src/types/database.generated.ts` — `node
  scripts/generate-db-types.mjs` (exit 0).
- **No application logic, onboarding, or UI changed.** Legacy NIM behavior
  is byte-identical.

## 2. Schema (all in `20261112000000_identity_bridge.sql`)

### 2.1 `academic_units` (lines 24-74 of the migration)

| Aspect | Shape |
|---|---|
| Columns | `id uuid PK`, `university_id → universities RESTRICT`, `parent_id uuid NULL`, `code text`, `name NOT NULL`, `unit_type NOT NULL` (free text; seed values faculty/department/program/branch/other), `status CHECK (draft, active, archived) DEFAULT 'draft'`, `created_by → profiles SET NULL`, `created_at`, `updated_at` |
| Composite uniqueness | `UNIQUE (id, university_id)` for children to reference |
| Cross-university parent | composite FK `(parent_id, university_id) → academic_units(id, university_id)` — rejects cross-tenant parents; NULL parent skips the check (MATCH SIMPLE) |
| Self-parent | `CHECK (parent_id IS DISTINCT FROM id)` |
| No cycles | trigger `check_academic_unit_cycle()` — ancestor walk from `NEW.parent_id`, advisory-lock serialized, 1000-hop guard |
| Duplicate code | partial unique indexes scoped to `(university_id, parent_id, code)` (parent non-null) and `(university_id, code)` (top-level), case-insensitive via `lower(btrim(code))` |

### 2.2 `university_memberships` support index

`CREATE UNIQUE INDEX university_memberships_id_university_unique ON
(id, university_id)` — enables the composite FK from `student_identities`.
No columns added; `student_id`/`entry_year` stay legacy mirrors (D-05).

### 2.3 `student_identities` (lines 109-141)

| Aspect | Shape |
|---|---|
| Columns | `id uuid PK`, `university_membership_id NOT NULL → memberships CASCADE`, `university_id NOT NULL → universities RESTRICT` (denormalized), `academic_unit_id NULL`, `student_id NOT NULL`, `entry_year NULL`, `status CHECK (pending, active, suspended, graduated) DEFAULT 'pending'`, `started_at`, `graduated_at`, `created_by → profiles SET NULL`, `created_at`, `updated_at` |
| Identity per membership | `UNIQUE (university_membership_id)` |
| Same-university unit/membership | composite FKs `(university_membership_id, university_id) → memberships(id, university_id)` [CASCADE] and `(academic_unit_id, university_id) → academic_units(id, university_id)` [RESTRICT] |
| student_id uniqueness | unique `(university_id, lower(btrim(student_id)))` — per-university; same string allowed at two universities |
| student_id format | same CHECK as NIM: `^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$` |
| entry_year | CHECK 1950–2100 when present; independent of academic periods (D-06) |
| CASCADE semantics | identity dies with its membership (`CASCADE`, mirrors `auth.users` → persona pattern) and is RESTRICT-ed by the university FK (tenant root never deletable under use) |

Lifecycle rules (migration header, D-07, documented): `graduated` may be
reactivated on the same row via the platform RPC (`graduated_at` cleared,
`started_at` preserved). `started_at` is set on first activation by the RPC.

### 2.4 Platform-admin RPC (lines 214-318)

`public.platform_upsert_student_identity(p_membership_id uuid,
p_academic_unit_id uuid, p_student_id text, p_entry_year int, p_status text)
RETURNS uuid`:

- `SECURITY DEFINER`, `search_path = ''`, explicit object qualification.
- Server-side platform-admin check via existing `is_platform_admin()` (D-09).
- Validates status, student_id format, entry-year range; resolves the
  membership's `university_id`; rejects a unit from another university.
- Upsert on `university_membership_id` (`ON CONFLICT DO UPDATE`), setting
  `started_at` (first active), `graduated_at` (set on graduate, cleared on
  reactivation), `created_by` = actor.
- Mirrors membership `status`; writes `audit_logs` via `record_audit`
  (actor/university/status in metadata); returns identity id.
- **Grants:** `REVOKE ALL … FROM public, anon, authenticated; GRANT EXECUTE
  TO authenticated`. No self-grant, no self-admin-assignment.
- Cycle guard function grant: revoked from everyone (trigger-only).
- `is_university_member(uuid)`: `STABLE` definer predicate
  (`search_path = ''`), EXECUTE to authenticated — used by unit RLS.

### 2.5 RLS (lines 175-208 of the migration)

- Both tables: RLS enabled, `REVOKE ALL FROM anon, authenticated`,
  `GRANT SELECT TO authenticated`. No write policies for any client role;
  writes go through service_role or the RPC.
- `academic_units_member_read`: active membership at the row's
  university OR platform admin.
- `student_identities_owner_read`: platform admin OR own membership
  (explicit `m.user_id = (select auth.uid())` + memberships RLS backstop).
- Existing policies untouched: `universities_active_read`,
  `university_memberships_owner_read`, and all earlier policies remain
  exactly as applied.
- Anonymous roles are denied everywhere (no grant on either table).

## 3. Compatibility (verified)

- `profiles.university` and `profiles.nim` untouched; `update_my_profile()`
  unmodified. Legacy global `profiles_nim_unique` untouched (D-10).
- Identity rows start empty (no backfill) — nothing reads the new tables
  yet; app: `npx tsc --noEmit` exit 0, `npx vitest run` 1079/1079.
- Migration ordering: `20261112000000` follows 5A's `20261111000000`; the
  user's WIP `20261110000000` was never executed (psql pipe only).

## 4. Blockers

### BLOCKED — dual-write legacy NIM ↔ identity (reason recorded in D-10)

Safe dual-write is impossible without solving the per-tenant-vs-global
uniqueness mismatch and the fuzzy `profiles.university` → registry mapping.
Documented here as the honest blocker rather than papered over.

### BLOCKED — Platform Admin sign-off gates (unchanged from 5A)

Registry row production, tenant enforcement in pre-existing RLS, and any
creation/activation UI remain gated on D-01's recorded status.

### BLOCKED (operational) — `pnpm db:types`

p JetSpeed 8: pnpm's automatic deps check hits the `pnpm approve-builds`
gate on dirty `apps/web/package.json`/`pnpm-lock.yaml` (pre-existing user
WIP, out of scope). The underlying script (`node
scripts/generate-db-types.mjs`) ran exit 0; same as 5A.

## 5. Rollback

Additive migration; **no destructive action taken in this session**
(tables were seeded then cleaned, never `DROP`). Local rollback procedure:

```sql
-- local stack only (never remote):
drop table if exists public.student_identities;  -- child first (FK CASCADE)
drop table if exists public.academic_units;
-- then delete supabase/migrations/20261112000000_identity_bridge.sql
-- from the working copy; the 2 tables were never pushed remotely.
```

Types revert: `git checkout -- apps/web/src/types/database.ts
apps/web/src/types/database.generated.ts`. The 5A tables and all legacy
columns remain untouched through any rollback.

## 6. Recommended Phase 5C (scoped, in priority order)

1. **Dual-write window (per ADR-018):** extend `update_my_profile()` (or a
   follow-up RPC) to upsert `student_identities` for the user's first
   membership once the registry mapping is approved — gated on D-10's
   blocker; keep global `profiles_nim_unique` as the onboarding guard.
2. **Registry mapping surface (platform-admin tooling):** distinct
   `profiles.university` values list for Platform Admin mapping to registry
   rows (fuzzy review queue, idempotent `INSERT … ON CONFLICT DO
   NOTHING`), then membership backfill.
3. **Academic units API:** read path for the onboarding/class UX (unit
   picker scoped to active memberships); write path through service_role
   only.
4. **Class `home_code`/`entry_year` linkage** to identities (bridge via
   Phase 4C §F) once units are populated.
5. **Contract tightening:** `NOT NULL` on `entry_year` + drop legacy
   membership academic columns, after verified backfill.
