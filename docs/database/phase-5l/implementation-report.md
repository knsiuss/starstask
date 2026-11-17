# Phase 5L — Implementation Report

## Migration

`supabase/migrations/20261119000000_phase5l_security_hardening.sql` (additive, no table/column changes):

1. `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;` +
   allow-list re-grants (10 public helpers). Fixes HIGH default-grant
   exposure of ~40 state-changing RPCs.
2. `course_invite_tokens` policy tightened from any university member
   to platform admin OR class admin of the linked offering's class.
3. `audit_logs_prevent_mutation()` trigger: BEFORE UPDATE OR DELETE
   raises `42501` for every role except `postgres`. INSERT (via
   `record_audit()` SECDEF or service_role worker) still works.
4. `ALTER FUNCTION … SET search_path=''` per OID for every SECDEF
   function previously at `public, pg_temp` (skips dynamic-SQL bodies).
5. `audit_logs`: `REVOKE ALL` + column-level `GRANT SELECT` to
   `authenticated` (non-sensitive columns only; no write grants).

## Tests (disposable local DB, 2026-11-05)

- `supabase/tests/phase5l-grants-validation.sql`:
  anon-on-write-RPC violations 0; public helpers intact;
  0 SECDEF functions with `pg_temp`; audit trigger + new policy present.
- `supabase/tests/phase5l-tenant-isolation-validation.sql`:
  T1–T9 all PASS (see `tenant-isolation-results.md`).
- App regression: `pnpm test` 100 files / 1132 passed;
  `tsc --noEmit --skipLibCheck` clean; ESLint clean on
  `attendance.ts` / `attendance-meetings.ts`.

## Security vulnerabilities fixed

- HIGH: anon EXECUTE on state-changing RPCs (default Supavisor/Postgres
  default-privilege grants) → revoked.
- HIGH: `course_invite_tokens` readable by any university member →
  class-admin-only.
- MEDIUM: `audit_logs` mutable via service_role (RLS bypass) →
  mutation trigger.
- MEDIUM: `pg_temp` in SECDEF `search_path` → `search_path=''` hardened.

## What did NOT change

- No tenant-table RLS policy change (existing model verified correct).
- No storage bucket visibility change (public `avatars`/`class-media`
  reads are intentional class-identity assets).
- No function converted SECDEF → INVOKER.
- No Phase 5K `session_checkin_summary_many` change (already
  `authenticated`-only + `search_path=''`).
- No app code change (no file in `apps/web/src` modified by this phase).

## Remaining risks / blockers

- Live Storage upload/overwrite/delete cross-tenant test not run
  (needs seeded objects + storage API; policy-level verified only).
- Second-university app-level tenant test beyond RPC stub (Phase 5K
  note still applies): PostgREST direct-table paths tested here via
  RLS simulation; full-app multi-tenant E2E still needs staging.
- Dynamic-SQL SECDEF helpers skipped from search_path hardening
  (internal-only, not anon-reachable; manually reviewed — see
  `rollback-plan.md`).
- `class-media` / `avatars` public reads cross universities by design
  (class identity images). Owner decision recorded as INFORMATIONAL.

## Staging / production status

- **NOT deployed to production. NOT applied to production.**
- Local disposable DB only. Local `supabase_migrations` ledger
  untouched (highest applied here still `20261109000000`; new
  migrations `20261110`–`20261119` are untracked working files).
- Promotion sequence in `rollback-plan.md`.
