# Phase 5A — Evidence Closure

> **Status:** COMPLETE. Every finding below was verified against the actual repository
> (files, lines, and local DB queries) during Phase 5A. No finding was copied from
> Phase 4C drafts without re-checking.
>
> **Classification key:**
> `VERIFIED` = confirmed by direct file/DB evidence read in this session.
> `REPORTED` = taken from a Phase 4C doc or prior work, not re-verified.
> `PROPOSED` = design recommendation, pending approval.
> `UNRESOLVED` = open question needing a human/platform decision.
> `BLOCKED` = cannot proceed without human input or a missing capability.

## 1. Current auth identity ↔ auth.users ↔ profiles

| Finding | Verdict |
|---|---|
| Canonical id is `auth.users.id` (uuid). `profiles.id` is a 1:1 FK `REFERENCES auth.users(id) ON DELETE CASCADE` (`supabase/migrations/20261029000100_core_schema.sql`). | **VERIFIED** |
| Signup provisions `profiles` via trigger `handle_new_user()` on `auth.users`, SECURITY DEFINER with `search_path = ''`, `INSERT ... ON CONFLICT (id) DO NOTHING` (`20261029002700_profile_onboarding.sql`). It derives display/full name and avatar from `raw_user_meta_data` (Google). | **VERIFIED** |
| The **only** FK in the entire migration set that references `public.profiles` directly is the one Phase 5A just added (`universities.created_by`, `SET NULL`). Every pre-existing FK in the system references `auth.users` directly (grep across all 93 migration files). | **VERIFIED** |
| Auth flow: Google OAuth PKCE (`supabase/config.toml` `[auth.external.google]`, env-injected credentials), `enable_signup = true`, `enable_anonymous_sign_ins = false`. Callback route: `apps/web/src/app/auth/callback/route.ts` (allowlisted `next` path, rate-limited, exchanges code for session cookies, records auth activity). It never touches `profiles` rows beyond session exchange — profile provisioning is entirely the DB trigger. | **VERIFIED** |
| `full_name` and `nim` are privacy-protected: no column grant to `anon`/`authenticated` (postgREST cannot select them). The owner reads them only via `get_my_profile()` (SECURITY DEFINER, re-derives `auth.uid()`). | **VERIFIED** (`20261029002700` header + grants) |
| Global NIM uniqueness: partial unique index `profiles_nim_unique ON (lower(btrim(nim))) WHERE nim IS NOT NULL` (`20261029003110_profile_nim_unique.sql`), pre-checked by a `DO` block that hard-fails on pre-existing duplicates instead of deleting them. | **VERIFIED** |
| `profiles.university` is free text, length CHECK 2–120 (`20261029002700`). No normalization, no registry, no FK. | **VERIFIED** |
| No `profiles.status` / disabled-account column exists. Account removal = `auth.users` delete → cascade. | **VERIFIED** (absence across migrations) |
| Onboarding gate: `onboarded_at` (set once by `update_my_profile()`), read via column grant on `onboarded_at` only. | **VERIFIED** |

## 2. Profile creation / update lifecycle

| Step | Evidence | Verdict |
|---|---|---|
| 1. User signs up via Google OAuth | `config.toml`, callback route | **VERIFIED** |
| 2. `auth.users` row created by Supabase Auth | Supabase Auth schema (out of repo) | **REPORTED** (Supabase convention) |
| 3. `handle_new_user()` trigger inserts `profiles` (display_name, full_name, avatar) | `20261029002700` | **VERIFIED** |
| 4. User completes onboarding form → `POST /api/profile/onboarding` → `saveOnboardingProfile` → `update_my_profile(p_full_name, p_nickname, p_nim, p_university, p_declared_class)` | `apps/web/src/app/api/profile/onboarding/route.ts`, `apps/web/src/lib/db/profiles.ts` | **VERIFIED** |
| 5. `update_my_profile()` validates (full name 2–80, nickname 2–60, NIM regex `^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$`, university 2–120), writes all fields + `onboarded_at = coalesce(onboarded_at, now())` | `20261029002700` | **VERIFIED** |
| 6. Class auto-join by typed name: `join_class_by_name()` (normalizes via `normalize_class_key()`, only `join_policy='open'` + `status='active'` classes, never grants admin) | `20261029002700` | **VERIFIED** |
| 7. Later profile edits: `PATCH /api/profile/route.ts` re-sends stored `nim`/`university` from `get_my_profile()` — the client cannot change them through this route (by design: "letting the browser supply them would turn this endpoint into a way to rewrite an institutional identifier"). | `apps/web/src/app/api/profile/route.ts:18,84–99` | **VERIFIED** |
| 8. Avatar: `set_my_avatar_url()` RPC; settings page + `ProfileAcademic` component display `university` free text (`apps/web/src/components/profile/profile-academic.tsx:58–61`). | grep + file reads | **VERIFIED** |

**Single-university assumption (load-bearing):** every step above assumes exactly one
university per user, expressed as one free-text value on the global `profiles` row.
There is no place in the current code where a user can belong to two universities.

## 3. All `profiles.university` dependencies

| Dependency | Location | Impact of a registry change |
|---|---|---|
| `university` column + CHECK + COMMENT | `20261029002700` | None if the column is kept (Phase 5A keeps it) |
| `get_my_profile()` returns `university` | `20261029002700` | None (unchanged) |
| `update_my_profile()` requires/returns it | same file; app `apps/web/src/lib/db/profiles.ts:56` | None (unchanged) |
| Onboarding form field | `apps/web/src/components/profile/profile-onboarding-form.tsx:28,123,356–365`, `apps/web/src/app/(onboarding)/onboarding/page.tsx:63`, route `…/api/profile/onboarding/route.ts:62` | None (unchanged) |
| Profile settings display + PATCH re-send guard | `apps/web/src/components/profile/profile-academic.tsx:19–61`, `apps/web/src/app/api/profile/route.ts:84–99` | None (unchanged) |
| Contracts schema (`myProfileSchema`, `profileOnboardingSchema`) | `@starstask/contracts` via `apps/web/src/lib/db/profiles.ts` imports | None (unchanged) |
| Generated types | `apps/web/src/types/database.generated.ts:2399,2413,2427` | Regenerated in 5A (types only, no behavior) |
| Marketing/privacy copy mentioning "university" | `(home)/page.tsx`, `privacy/page.tsx`, `layout.tsx`, etc. | Prose only — not data dependencies |

**Conclusion:** the entire `profiles.university` surface is display + onboarding
free-text plumbing. Phase 5A changes none of it. Renaming/removing it belongs to a
later phase after the registry backfill (expand-contract per ADR-018).

## 4. Global uniqueness conflicts with a per-university model

| Conflict | Analysis | Verdict |
|---|---|---|
| `profiles.nim` global unique vs member passes `student_id` per-university unique | The same human at two universities **legitimately has two different NIMs**. `university_memberships` stores one `student_id` *per university row*, so this is expressible — but the existing global `profiles_nim_unique` would block the second onboarding if both happened to be the same string. Because `profiles.nim` stays as the single global onboarding field until backfill, multi-university onboarding is status-quo single-university. | **VERIFIED** conflict exists in design; not solvable in 5A without backfill decisions |
| `UNIQUE(user_id, university_id)` on memberships | One persona per (user, university). A user with two NIMs at the same university cannot be represented — matches ADR-001 (one persona per university; duplicates are registrar corrections, not second rows). | **PROPOSED** (retained in migration) |
| `profiles.university` free text vs registry names | Any future backfill must map fuzzy strings (typos, abbreviations) to registry rows — explicitly **not auto-mappable** (Phase 4C §30.3). | **UNRESOLVED** → backfill **BLOCKED** |

## 5. FKs referencing profiles / auth.users

| Finding | Verdict |
|---|---|
| Pre-existing FKs: 100% reference `auth.users(id)` (grep-verified across all migrations; zero pre-existing references to `public.profiles`). | **VERIFIED** |
| New FKs added by Phase 5A: `university_memberships.user_id → auth.users(id) CASCADE`; `university_memberships.university_id → universities(id) RESTRICT`; `universities.created_by → profiles(id) SET NULL`. The `created_by` FK is the first direct FK to `profiles` in the repo — justified because it records which platform admin created the row (an identity fact, not an auth fact), and `SET NULL` preserves registry rows if the admin account is removed. | **VERIFIED** (grep + `\d` output) |
| `ON DELETE RESTRICT` on memberships→universities prevents deleting a tenant that has users. Tested locally: delete blocked with FK violation. | **VERIFIED** (local psql) |

## 6. Functions/triggers assuming a single university

| Function | Single-university assumption | Verdict |
|---|---|---|
| `handle_new_user()` | Creates a global profile with no university concept at all. Future membership creation must happen elsewhere (onboarding or platform-admin RPC). | **VERIFIED** — untouched by 5A |
| `update_my_profile()` | Writes one `university` string. Any registry-aware onboarding requires a new/extended RPC (Phase 5B+). | **VERIFIED** — untouched |
| `is_platform_admin()` | Global (platform-wide), SECURITY DEFINER, `search_path = ''`. Correct under the multi-tenant model; needs no change. | **VERIFIED** (`20261029001100:14`) |
| `is_class_member()` / `is_class_admin()` / `can_manage_class()` | Class-scoped only, no tenant parameter. Tenant guard is a later concern (Phase 4C §24.3 — add tenant check without changing call-site shape). | **VERIFIED** — untouched |
| `set_updated_at()` trigger function | Reused for the two new tables. `search_path = ''` already correct. | **VERIFIED** |
| Any RPC reading `profiles.university` to scope tenancy | None exists — no tenant isolation currently keys off university at all. Multi-tenancy is **greenfield**: 5A adds the root tables only; nothing enforces them yet. | **VERIFIED** (grep) |

## 7. RLS depending on profile structure

| Finding | Verdict |
|---|---|
| `profiles` RLS: `profiles_public_read` (SELECT for anon+authenticated, `USING (TRUE)`, but column grants restrict to `id/display_name/avatar_url`) + `profiles_owner_update` (self only, limited columns). | **VERIFIED** (`20261029000300_rls.sql`) |
| New policies added in 5A do not reference `profiles` at all; the membership owner-read policy keys on `auth.uid()` directly (same pattern as existing self-predicates, ADR-015-compliant: no recursion via `profiles`). | **VERIFIED** |
| `is_platform_admin()` is called by existing policies/RPCs, not by 5A policies. 5A write protection is by *absence of grant/policy* (service_role only), the same convention as the existing `platform_admins` table. | **VERIFIED** |

## 8. User-facing behaviors at risk

| Behavior | Risk from 5A | Verdict |
|---|---|---|
| Onboarding (free-text university) | None — untouched | **VERIFIED** (no code path changed) |
| Profile settings, avatar, bio | None — untouched | **VERIFIED** |
| Auth callback / session | None — untouched | **VERIFIED** |
| Class join by name | None — untouched | **VERIFIED** |
| Any query against `universities`/`university_memberships` from the app | None exists yet; tables are unread by app code | **VERIFIED** (grep: zero app references) |
| Typecheck after regen | Real risk — `database-contract.ts` pins generated/hand table sets. Mitigated by adding both tables to hand-maintained `database.ts` in the same commit (see `identity-implementation-report.md`). | **VERIFIED + mitigated** |

## 9. Local environment findings

| Finding | Verdict |
|---|---|
| Local Supabase stack is running (DB `supabase_db_starstask` healthy, 9h uptime). `supabase status` succeeds (exit 0). Only imgproxy/edge-runtime/pooler are stopped — irrelevant to migrations. | **VERIFIED** |
| Local DB has all 92 applied migrations except the user's WIP `20261110000000_subject_enrollment.sql` (which only creates `class_subject_members`, absent from committed generated types). Local DB was otherwise **empty** (0 profiles/classes/admins). | **VERIFIED** (`migration list`, counts) |
| Therefore DB execution tests **are** possible (applied new migration via local psql, verified constraints/RLS) and `pnpm db:types` regen **is** legitimate (no WIP types lost, because the committed generated file never contained the WIP table). | **VERIFIED** — nothing BLOCKED on environment |
| Push vs query: the new migration was applied to the local DB with `psql` (piped file), **not** `supabase db push`, deliberately so the user's unapplied WIP migration was never executed locally. Consequence: `supabase_migrations` history does not record `20261111000000` on this stack; it remains a pending local migration. This is intentional and documented. | **VERIFIED** (documented decision) |

## 10. Open evidence gaps carried forward

| Gap | Verdict |
|---|---|
| `profiles.university` distinct values in any real database (fuzzy mapping source) | **UNRESOLVED → BLOCKED** (needs Platform Admin review; local DB is empty) |
| Whether a "disabled" global account state is needed (see `07` §7.4) | **UNRESOLVED** (no evidence of need; per-university `status` suffices for 5A) |
| Multi-provider (non-Google) identity | **UNRESOLVED** (only Google configured today) |
| `rls_auto_enable` presence in prod (Phase 4C open Q11) | **REPORTED** — not needed for 5A (explicit `ALTER TABLE ... ENABLE RLS` used) |
| Live row counts / performance (Q12) | **REPORTED** — local DB is empty; production counts unknown |
