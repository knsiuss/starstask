# Phase 5H — Phase 5B Verification (Identity Foundation)

## Verdict: **PARTIALLY VERIFIED** (schema-level only; application integration absent; local DB state not re-verified)

### `universities`

- File: `supabase/migrations/20261111000000_universities_and_memberships.sql`
- 19 columns; `slug` UNIQUE + format/length CHECK; `code` nullable + partial unique on `lower(btrim(code))`;
  `status` CHECK `(registered, pending, active, suspended, inactive)`; HTTPS-only website/logo checks;
  FK `created_by → profiles SET NULL`; status index; updated_at trigger.
- RLS enabled; `GRANT SELECT` to authenticated; `REVOKE` from anon; policy `universities_active_read` (active only).
- VERIFIED on disk. Visibility path is sound (registry ≠ activation).
- UNVERIFIED: any row existence / current DB state.

### `university_memberships`

- `(university_id, lower(btrim(student_id)))` UNIQUE partial WHERE student_id IS NOT NULL → university-scoped NIM.
- `UNIQUE (user_id, university_id)`; FKs: user → auth.users CASCADE, university → universities RESTRICT.
- RLS: owner read; no client insert/update/delete; anon denied.
- `entry_year` present (nullable CHECK 1950–2100) — ADR-004 separation observed.

### `academic_units`

- File: `20261112000000_identity_bridge.sql`.
- `university_id` FK RESTRICT; `parent_id` nullable; **composite FK** `(parent_id, university_id) → academic_units(id, university_id)`
  (index-backed cross-tenant prevention; `MATCH SIMPLE` leaves top-level units unbound).
- `UNIQUE(id, university_id)` support index; self-parent CHECK; code-scoped partial unique indexes;
  cycle-prevention trigger (`academic_units_cycle_guard`, ancestor walk + advisory lock).
- Listed in generated types (verified by grep count).

### `student_identities`

- `university_membership_id` FK CASCADE, `university_id` denormalized (composite FK), `academic_unit_id` nullable composite FK
  (MATCH SIMPLE protects root units); `student_id` NIM-format CHECK; per-university unique; `UNIQUE(university_membership_id)`.
- `entry_year` nullable (expected until ADR-004 tightening); lifecycle `pending/active/graduated/↔ archived` not present as enum —
  status text with checks; graduated→active reactivation rule documented, not enforced in DB enum.
- `started_at`, `graduated_at`, timestamps present. Generated types include the table (verified by grep).

### Platform Admin authorization

- `is_platform_admin()` is referenced by new RLS/RPC; existing migration evidence `20261029000900` / `20261029001100` (per 5B report).
- `platform_upsert_student_identity` RPC: SECURITY DEFINER, `search_path=''`, explicit object qualification,
  REVOKE from public/anon/authenticated, GRANT EXECUTE to authenticated only, `is_platform_admin()` gate,
  same-university validation, audit via `record_audit(...)`. VERIFIED on disk.

### Legacy compatibility

- `profiles_nim_unique` intact: `20261029003110_profile_nim_unique.sql` — partial unique index on
  `lower(btrim(nim))` WHERE nim IS NOT NULL; still enforces one account per NIM **globally**. It does NOT permit
  duplicate NIMs across universities and has not been superseded.
- `profiles.university` still free-text display column (`20261029002700`); onboarding writes it; settings displays it;
  API validates presence (`apps/web/src/app/api/profile/route.ts:87`, `:99`;
  `apps/web/src/components/profile/profile-onboarding-form.tsx`). No tenant semantics attached — VERIFIED no `from("universities")` usage in app code.
- Legacy `class_members`/`class_admins` untouched by 5C–5G. VERIFIED by grep and migration diff review.
- No backfill occurred: migration headers and §14 reports state it; validation script cleans test rows.
  **NOT RE-RUN in this audit** (would mutate local DB).

### Integrity findings

- `university_memberships.student_id` is text and format-checked, but membership↔identity uniqueness
  (`university_memberships_user_university_unique`) + identity `UNIQUE(university_membership_id)` together prevent
  duplicate identities per membership. OK.
- `academic_units` code uniqueness is parent-scoped; top-level units use a separate partial index; ordering is sound.
- No FK cascade from `universities` on RESTRICT; deletion blocked while members exist. OK.
- `profiles.nim` is still world-unique; NOT migrated. Gap: duplicate NIM across two universities is still impossible
  at the legacy index, even after identity migration. **This is the Phase 5A/5B blocker preserved by design.**
- No application feature can create a membership/identity: RLS denies insert; RPC exists but no app route calls it
  (verified `from("university_memberships")`/`rpc("platform_upsert...")` produce zero app matches).

### Explicit verdict per 5B

- **VERIFIED:** DDL, constraints, RLS policies, RPC authorization model, legacy NIM unchanged, no activation.
- **PARTIALLY VERIFIED:** current local DB parity (not re-executed).
- **NOT VERIFIED:** production existence/behavior.
- **NOT IMPLEMENTED:** application flows to create/select/manage memberships (onboarding university picker does not exist in app code).

**Overall 5B: PARTIALLY VERIFIED — schema implemented; app integration absent; local/production unverified.**
