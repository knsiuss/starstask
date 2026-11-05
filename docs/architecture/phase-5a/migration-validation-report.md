# Phase 5A — Migration Validation Report

> **Status:** Migration `20261111000000_universities_and_memberships.sql` was
> executed against the **local** Supabase stack and functionally verified.
> Nothing was pushed to, or run against, the linked remote project.

## 1. Environment

| Fact | Evidence |
|---|---|
| Local stack running | `supabase status` exit 0; `supabase_db_starstask` "Up 9 hours (healthy)". Only `imgproxy`/`edge_runtime`/`pooler` stopped (irrelevant). |
| Local DB content | Initially empty: `profiles=0, classes=0, platform_admins=0`; all 92 applied migrations present, all except the user's WIP `20261110000000_subject_enrollment.sql` (verified via `supabase migration list`). |
| Why files vs content are consistent | WIP migration only creates `class_subject_members`, which is **absent** from the committed `database.generated.ts` (grep: no match). So local-schema === committed-types baseline + Phase 5A tables. Types regen is safe. |

## 2. How the migration was applied (and how it was NOT)

**Applied via piped psql, deliberately NOT `supabase db push`:**

```powershell
Get-Content supabase/migrations/20261111000000_universities_and_memberships.sql -Raw |
  docker exec -i supabase_db_starstask psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Result: success (all CREATE TABLE/INDEX/TRIGGER, ALTER TABLE, REVOKE, GRANT,
DROP POLICY (NOTICE "does not exist" — expected, idempotent guard), CREATE POLICY).
Shell exit code 1 was PowerShell surfacing docker/psql stderr NOTICEs, not a SQL error.

Reason: `supabase db push` would also have executed the user's unapplied WIP
migration `20261110000000_subject_enrollment.sql` during this session. Avoided
per the Phase 5A safety limits. Consequence: local `supabase_migrations` history
does **not** record `20261111000000` (it remains a "pending" local migration —
identical in state to the WIP file, which is also pending).

**Explicitly NOT done:** `supabase db push --remote`, `db reset`, any `TRUNCATE`/
destructive SQL, any production connection, any `supabase start` (already running).

## 3. Functional verification (local psql, throwaway data cleaned up)

Seed: `universitas-contoh` (active) + `universitas-lain` (registered); one
throwaway `auth.users` + `profiles` + 2 throwaway memberships. All seed rows
deleted at the end; post-cleanup counts: `universities=0, memberships=0`.

| # | Check | Expected | Actual |
|---|---|---|---|
| 1 | Insert 2 universities (service role) | success | `INSERT 0 2` |
| 2 | Duplicate `slug` | unique violation | `ERROR: duplicate key value violates unique constraint "universities_slug_unique"` |
| 3 | Duplicate `code` in different case (`UC01` vs `uc01`) | unique violation | `ERROR: duplicate key value violates unique constraint "universities_code_unique"` |
| 4 | `SET ROLE anon; SELECT count(*) FROM universities` | permission denied (no grant) | `ERROR: permission denied for table universities` |
| 5 | `SET ROLE authenticated; SELECT count(*)` with 1 active + 1 registered | 1 (active only) | `1` |
| 6 | Duplicate `(user_id, university_id)` membership | unique violation | `ERROR: duplicate key value violates unique constraint "university_memberships_user_university_unique"` |
| 7 | Same `student_id` (`nim001`) at a *second* university | allowed (per-tenant unique) | `INSERT 0 1` (total memberships = 2) |
| 8 | Delete referenced university | RESTRICT violation | `ERROR: ... violates foreign key constraint "university_memberships_university_id_fkey"` |
| 9 | Invalid `status` (`bogus`) | CHECK violation | `ERROR: ... violates check constraint "universities_status_allowed"` |
| 10 | Cleanup deletes | all 0 | `universities_after_cleanup=0, memberships_after_cleanup=0` (auth.users + profiles throwaway also removed; profiles row auto-deleted by CASCADE) |
| 11 | Schema dump after apply (`\d`) | columns/indexes/checks/FKs/policies/triggers as designed | Verified: `universities` (19 cols, 4 indexes incl. partial `code` unique, 9 checks, `created_by→profiles SET NULL`, policy `universities_active_read`, trigger present); `university_memberships` (9 cols, 4 indexes incl. partial `student_id` unique, `user_id→auth.users CASCADE`, `university_id→universities RESTRICT`, policy `university_memberships_owner_read`, trigger present) |

**Not tested (honest gaps):**
- The `user_id = (select auth.uid())` owner-read policy body under a real JWT —
  `SET ROLE` without session claims cannot mint `auth.uid()`. The policy text
  is byte-identical in pattern to existing policies (`profiles_owner_update`,
  `avatars_storage_*`). Recommend an API-level test when the app first queries
  memberships (Phase 5B).
- `updated_at` auto-bump (trigger reuses the existing `set_updated_at()`;
  trust by reuse, not by observation).
- `auth.users` CASCADE on membership rows when a user is deleted: FK definition
  verified in `\d`; not exercised (would require a user-deletion round trip
  against the throwaway auth user — the throwaway `profiles` row was cascade-
  verified instead, since `profiles.id → auth.users CASCADE`).

## 4. Types regeneration

- `pnpm db:types` → **failed before running the generator**: pnpm's deps-status
  check auto-runs `pnpm install`, which is blocked by the `pnpm approve-builds`
  gate because `apps/web/package.json`/`pnpm-lock.yaml` are dirty from pre-existing
  user WIP. This is pre-existing WIP interference, not caused by 5A.
- `node scripts/generate-db-types.mjs` directly → **exit 0**, `Wrote apps\web\src\types\database.generated.ts`.
- Diff: 280 insertions / 70 deletions. Substance: the two new tables. Remainder:
  supabase CLI version formatting drift (`ComputedFields: never` added,
  `Json → NonNullable<Json>`, `__InternalSupabase` block dropped). No existing
  table's columns changed — consistent with local DB being baseline + 2 tables.
- Hand-maintained `apps/web/src/types/database.ts` updated with both tables
  (Row/Insert/Update/Relationships; enums narrowed per file convention).
  Before this edit, `npx tsc --noEmit` failed with
  `database-contract.ts(44,3): error TS2344: Type 'ExtraTables' does not satisfy the constraint 'never'`
  — proving the sync check works, and proving the fix was necessary and sufficient:
  after the edit, **tsc exit 0**.

## 5. App validation

| Command | Real output |
|---|---|
| `npx tsc --noEmit` (apps/web) | **exit 0**, no errors |
| `npx eslint src/types/database.ts src/types/database-contract.ts` | **exit 0** |
| `npx vitest run` (apps/web) | **94 files, 1079/1079 tests passed** (two consecutive green runs; one earlier run showed 1078/1079 with an unidentified flake, not reproduced) |
| `pnpm --filter @starstask/web lint` | Could not run — same pre-existing pnpm gate as §4. Mitigated by eslint above covering both changed files. |

No test files were added or modified by 5A. The migration-versions and
migration-regex-bounds unit tests (which validate migration filenames/ordering)
passed as part of the 1079.

## 6. Rollback verification

No rollback was executed (nothing to roll back — additive, unpushed).
Local rollback commands are documented in
[`identity-implementation-report.md`](./identity-implementation-report.md) §7;
they have been read through but, per the "no destructive action" constraint
beyond local bring-up, the drop statements were **not** executed against the
running local stack (the applied local tables were left in place so the
schema matches the committed migration for anyone inspecting locally).

## 7. Residual state

- Local DB now contains the two new tables (empty) + unchanged everything else.
- `supabase_migrations` history records neither `20261111000000` (5A) nor
  `20261110000000` (user WIP) — both are pending on this stack by design.
- Linked remote (`kdqsrckmmoucdqiapovr`): **never contacted** for writes;
  `supabase status` only reported the link metadata.
