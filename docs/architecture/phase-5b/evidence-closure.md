# Phase 5B — Evidence Closure

> **Status:** Every claim below cites a file or a live-DB observation from this
> session. **VERIFIED** = observed in the repo or executed against the local
> stack. **REPORTED** = quoted from prior phases without re-verification.
> CONFLICTS between earlier docs are noted with the resolution.

## 1. What was read

Phase 4C: `08`, `09`, `10`, `11`, `23`, `24`, `26` (§26-C/§26-E), `27`, `29`,
`30`, `34` (ADRs), `36`. Phase 5A: `evidence-closure.md`,
`identity-implementation-report.md`, `migration-validation-report.md`,
`decision-register.md`, plus the migration
`20261111000000_universities_and_memberships.sql` as applied. Code: profiles
NIM migration, onboarding function, `is_platform_admin` + grants, class RLS.

## 2. Prior-phase state (unchanged in 5B)

- VERIFIED: `supabase/migrations/20261111000000_universities_and_memberships.sql`
  creates `universities` + `university_memberships`, RLS read-only, no anon
  access, no `university_id` on any other table. Untouched in 5B — `git diff`
  on that file is empty (see `migration-validation-report.md` §1).
- REPORTED (5A): local DB then contained the two empty tables, no rows.
  Re-verified at 5B start: `select count(*) from public.universities` → `0`.

## 3. `profiles.nim` — exact definition and live behavior

VERIFIED, `supabase/migrations/20261029003110_profile_nim_unique.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nim_unique ON public.profiles (lower(btrim (nim)))
WHERE
  nim IS NOT NULL;
```

So: partial (NULL NIMs exempt), case-insensitive, trimmed, **global**
(one NIM → one account across all universities). §11.1 flags this as a
"multi-tenant risk": the same NIM string at two universities for two
different people is rejected today.

App dependencies on `profiles.nim` (VERIFIED by grep this session):

| Surface            | Evidence                                                                                                                                                          | Role                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Onboarding write   | `update_my_profile()` sets `profiles.nim` + `profiles.university` (`20261029002700_profile_onboarding.sql:300`); app wrapper `apps/web/src/lib/db/profiles.ts:48` | Actively written on every onboarding save.                    |
| Authenticated read | `get_my_profile()` + settings page `settings/profile/page.tsx:144`                                                                                                | Display of the raw NIM.                                       |
| Attendance flows   | `student-meeting-list.tsx` (nim input), `attendance-meetings/pdf.ts`, `excel.ts`, `attendance-sheet.tsx` (display), `meeting-service.ts` (RPC arg)                | Read + write via `update_my_profile`-adjacent RPCs (`p_nim`). |

Conclusion (VERIFIED): `profiles.nim` IS actively written by onboarding and
read by display/attendance code. It is the **current system of record** for
the student ID. `student_identities.student_id` is a parallel per-university
record; no 5B code reads from it (postponed; dual-write is a gated later
step). The global unique index stays exactly as-is.

## 4. Platform-admin mechanism (the existing mechanism, verified)

- VERIFIED, `20261029000900_classes.sql:23-30`: `platform_admins(user_id PK
→ auth.users CASCADE, granted_at, granted_by)`. "Written only through SQL
  or the service role". RLS enabled, **no client policies at all**
  (`20261029001200_class_rls.sql:41-46` — REVOKE ALL from anon/authenticated).
- VERIFIED, `20261029001100_class_functions.sql:14-29`: `is_platform_admin()`
  is `STABLE`, `SECURITY DEFINER`, `search_path = ''`, `EXISTS(... platform_admins
WHERE user_id = (select auth.uid()))`. Grants: `REVOKE ALL FROM public;
GRANT EXECUTE TO authenticated` (lines 1335, 1355-1356) — i.e. no anon
  access, deliberate.
- At least 19 migration files call `is_platform_admin()` in RPC gates and RLS
  policies (count RECORDed in 4C `24`; pattern re-confirmed by grep).
- `record_audit(action, entity_type, entity_id, class_id, metadata)` is
  internal-only (revoked from authenticated, `20261029001100:1321`), callable
  from definer functions — the pattern 5B's RPC reuses.
- OpenAPI-app surface: `platform-admin queries` exist (`20261029003000`) and
  are already gated on the same predicate.

⇒ Phase 5B's RPC **reuses this exact mechanism**; no new admin primitive
was invented. No ambiguity remained, so the "STOP and report" branch of
the brief was not triggered.

## 5. Onboarding compatibility boundary

VERIFIED: `update_my_profile()` (`20261029002700:262-314`) validates full
name, nickname, NIM format, university text length, then `UPDATE profiles ...
onboarded_at = coalesce(onboarded_at, now())`. It **cannot create
memberships** (no membership logic anywhere in the function) and Phase 5B
doesn't modify it. Ordinary onboarding therefore still cannot activate a
university or grant a membership in 5B. `profiles.university` is retained
unchanged. No onboarding UI redesigned.

## 6. Local DB state at 5B start (VERIFIED by psql)

- `public.universities`: 0 rows; `profiles`: 0; `platform_admins`: 0 —
  the stack was clean (5A seeded then cleaned up).
- `supabase migration list`: `20261111000000` (5A) recorded as pending
  because 5A applied via piped psql, never `db push` (REPORTED in 5A
  `migration-validation-report.md` §2). 5B follows the same piped-psql
  route; neither `20261110000000_subject_enrollment.sql` (user WIP) nor any
  earlier pending file was executed by 5B.
