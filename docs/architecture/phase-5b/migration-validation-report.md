# Phase 5B — Migration Validation Report

> Migration `20261112000000_identity_bridge.sql` was executed against the
> **local** Supabase stack and functionally verified. Nothing was pushed to
> or run against the linked remote project.

## 1. Environment

| Fact                | Evidence                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local stack running | `supabase_db_starstask` container healthy (5A report, unchanged).                                                                                    |
| Pre-state           | `public.universities` empty (verified `count=0` at 5B start); `profiles=0`; `platform_admins=0`.                                                     |
| 5A state unchanged  | `git status` at start + end shows the pre-existing user WIP (listed below) and this phase's footprint only; the `20261111000000` file shows no diff. |

## 2. How the migration was applied (and how it was NOT)

**Applied via piped psql, deliberately NOT `supabase db push`** (same
route as 5A — avoids executing the user's unapplied WIP
`20261110000000_subject_enrollment.sql`):

```powershell
Get-Content supabase/migrations/20261112000000_identity_bridge.sql -Raw |
  docker exec -i supabase_db_starstask psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

First attempt hit `there is no unique constraint matching given keys for
referenced table "academic_units"` (composite FK created before its
referenced-side unique index). **Fixed before any other test ran:** moved
the FK into a separate `ALTER TABLE … ADD CONSTRAINT` after the
`academic_units_id_university_unique` index (migration §2.1 note). Re-apply
after the fix: success — all CREATE TABLE/INDEX/TRIGGER/CONSTRAINT, both
RLS policies, both triggers, both functions, grants; only the two standard
`DROP POLICY ... does not exist` NOTICEs (idempotent guards). Exit code 1
was PowerShell surfacing NOTICEs, matching 5A's experience.

Consequence (documented): local `supabase_migrations` history records
neither `20261112000000` (5B) nor `20261111000000` (5A) nor the WIP
`20261110000000`; all three remain "pending" on this stack by design.

**Explicitly NOT done:** `supabase db push --remote`, `db reset`, any
`TRUNCATE`/destructive SQL, any production connection, any `supabase
start` (already running).

## 3. Functional verification (local psql, throwaway data cleaned up)

Seeds: two universities `val-uni-a`/`val-uni-b` (both `active`), two
throwaway `auth.users` + auto-created `profiles` (the `handle_new_user`
trigger creates profiles on user insert — duplicate-key on manual profile
insert is expected and harmless), memberships at one university each,
units `FTEK` → `IF` at A, `FTEK` at B. Everything deleted at the end;
final counts `universities=0, academic_units=0, student_identities=0,
university_memberships=0, audit_left=0`.

| #   | Check                                                                       | Expected                                   | Actual                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cross-university parent (parent in A, row in B)                             | FK violation                               | `ERROR: … violates foreign key constraint "academic_units_parent_same_university"`                                                                                                                                  |
| 2   | Self-parent                                                                 | CHECK or trigger violation                 | `ERROR: academic unit cannot be its own parent` (trigger, CONTEXT `check_academic_unit_cycle() line 10`)                                                                                                            |
| 3   | Duplicate code under **same** parent                                        | unique violation                           | `ERROR: duplicate key … "academic_units_code_unique_under_parent"`                                                                                                                                                  |
| 4   | Same code at top level (different parent scope)                             | allowed                                    | `INSERT 0 1`                                                                                                                                                                                                        |
| 5   | Same code under a different non-null parent                                 | allowed                                    | `INSERT 0 1`                                                                                                                                                                                                        |
| 6   | Cycle (UPDATE parent to create DFS loop)                                    | trigger violation                          | `ERROR: academic unit hierarchy cycle detected`                                                                                                                                                                     |
| 7   | Cross-tenant unit unit_id sanity                                            | allowed parent chain                       | FTEK→IF inserts `INSERT 0 1` each                                                                                                                                                                                   |
| 8   | Identity happy path (unit in same university)                               | insert                                     | `INSERT 0 1`                                                                                                                                                                                                        |
| 9   | Duplicate `student_id` within one university                                | unique violation                           | `ERROR: duplicate key … "student_identities_student_id_unique"`                                                                                                                                                     |
| 10  | Same `student_id` at a **second** university                                | allowed                                    | `INSERT 0 1`                                                                                                                                                                                                        |
| 11  | Unit from A on identity at B                                                | FK violation                               | `ERROR: … violates foreign key constraint "student_identities_unit_same_university"`                                                                                                                                |
| 12  | Membership at A + `university_id` B                                         | composite FK violation                     | `ERROR: … violates foreign key constraint "student_identities_membership_same_university"`                                                                                                                          |
| 13  | Duplicate identity per membership                                           | unique violation                           | `ERROR: duplicate key … "student_identities_membership_unique"`                                                                                                                                                     |
| 14  | `entry_year=1900`                                                           | CHECK violation                            | `ERROR: … violates check constraint "student_identities_entry_year_range"`                                                                                                                                          |
| 15  | `status='bogus'`                                                            | CHECK violation                            | `ERROR: … violates check constraint "student_identities_status_allowed"`                                                                                                                                            |
| 16  | Lifecycle (direct update): `graduated` then reactivate `active`             | `graduated_at` cleared                     | reactivated row: `status=active, graduated_at=false`; `started_at` never set by direct DML (RPC sets it, #20)                                                                                                       |
| 17  | Anon SELECT on both new tables                                              | permission denied                          | `ERROR: permission denied for table student_identities/academic_units` (to anon)                                                                                                                                    |
| 18  | Anon INSERT                                                                 | permission denied                          | `ERROR: permission denied for table academic_units`                                                                                                                                                                 |
| 19  | Authenticated INSERT (no write policy)                                      | permission denied                          | `ERROR: permission denied for table student_identities` (to authenticated)                                                                                                                                          |
| 20  | Owner RLS (user1, active member of A)                                       | own rows only                              | `user1_visible_identities=1, units_a=2, units_b=0`; user2 (member of B, pre-admin-grant): `user2_visible_identities=0`                                                                                              |
| 21  | RPC happy path (admin, args resolved pre-role-switch)                       | upsert + timestamps                        | returned uuid; `status=active, started_set=t, graduated_set=f`                                                                                                                                                      |
| 22  | RPC audit                                                                   | row written                                | `action=student_identity_upsert, entity_type=student_identity, has_actor=t`                                                                                                                                         |
| 23  | RPC update to `graduated`                                                   | preserved `started_at`, `graduated_at` set | `started_kept=t, graduated_set=t`                                                                                                                                                                                   |
| 24  | RPC reactivation `graduated→active`                                         | same row, `graduated_at` cleared           | `started_kept=t, graduated_cleared=f→t observed as graduated non-null=false`; `identity_rows_for_membership=1`                                                                                                      |
| 25  | Membership status mirror                                                    | RPC keeps persona status                   | after RPC `suspended` on a `pending` membership: row shows `suspended` (verified as postgres after COMMIT)                                                                                                          |
| 26  | RPC foreign-university unit                                                 | rejected                                   | `ERROR: academic unit does not belong to the membership university`                                                                                                                                                 |
| 27  | RPC by non-admin                                                            | rejected                                   | `ERROR: platform admin required` (42501 raised)                                                                                                                                                                     |
| 28  | RPC by anon (not in log but EXECUTE revoked)                                | —                                          | REVOKE covers anon; code path raises `authentication required` (42501) for null `auth.uid()`                                                                                                                        |
| 29  | RPC with args as the _invoker_ under RLS (user2 reading user1's membership) | membership not found (RLS)                 | `ERROR: membership not found` — correct: a non-owner admin cannot resolve another user's membership via a plain subquery under invoker RLS, but **can** via the RPC when the id is known (postgres-resolved in #21) |
| 30  | Legacy NIM untouched                                                        | —                                          | `count(profiles)=2` (today's seed only); `profiles_nim_unique` not dropped (grep: zero references in `20261112000000`)                                                                                              |

**Honest gaps:**

- The `undefined RLS owner-check under a real JWT` — verified via
  `request.jwt.claims` injection (`set local role authenticated; set local
request.jwt.claims…`), one step above `SET ROLE` alone. Real PostgREST
  JWTs exercise the same `auth.uid()` + RLS path.
- Cycle-walk under concurrency (advisory-lock serialization) is by design
  and lock-safety-reviewed, not race-tested under parallel load.

## 4. Types regeneration

- `pnpm db:types` → **blocked** (pnpm's deps check runs `pnpm install`,
  which hits the `pnpm approve-builds` gate on pre-existing dirty
  `apps/web/package.json`/`pnpm-lock.yaml`). Not modified by 5B.
- `node scripts/generate-db-types.mjs` directly → exit 0, `Wrote
apps/web/src/types/database.generated.ts`. Regenerated output includes
  both new tables with their composite-FK Relationships, plus current
  formatting drift consistent with 5A's baseline.
- Hand-maintained `apps/web/src/types/database.ts` updated with both
  tables (Row/Insert/Update/Relationships). Before the manual edit, `npx
tsc --noEmit` failed with `database-contract.ts(44,3): error TS2344:
Type 'ExtraTables' does not satisfy the constraint 'never'` — the
  contract check firing on the newly generated tables — and after the edit
  **tsc exit 0**, proving the sync obligation and sufficiency.

## 5. App validation

| Command                                                           | Real output                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` (apps/web)                                     | **exit 0**                                                                                                                                                                                                                          |
| `npx eslint src/types/database.ts src/types/database-contract.ts` | **exit 0**                                                                                                                                                                                                                          |
| `npx vitest run` (apps/web)                                       | **94 files, 1079/1079 tests passed** (single run; includes the migration-versions + migration-regex-bounds tests, which scan every `*.sql` in `supabase/migrations` — new file passes both: unique version, no `{m,n}` bound > 255) |
| `pnpm --filter @starstask/web lint` / `pnpm typecheck`            | **Could not run** — same pre-existing pnpm gate; mitigated by the direct `npx` runs above                                                                                                                                           |

## 6. Rollback verification

No rollback was executed (nothing to roll back — additive, unpushed).
Local rollback commands are documented in
[`identity-bridge-implementation.md`](./identity-bridge-implementation.md)
§5; they drop `student_identities` then `academic_units` (no other
objects reference the new tables, so no cascading loss). The FK to
`university_memberships` dies with `student_identities`; the support
unique index on `university_memberships` is harmless to leave. Deleting
the migration file leaves the local stack equivalent to the pre-5B state.

## 7. Residual state

- Local DB: both new tables exist (empty) + unchanged everything else.
- `supabase_migrations` history: `20261112000000` unrecorded by design.
- Linked remote: never contacted for writes; `supabase status` only read
  metadata.
- Pre-existing dirty worktree: preserved; `git status` start/end in
  `identity-bridge-implementation.md` §1 footprint.
