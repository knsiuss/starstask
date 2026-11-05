# Phase 5I — Baseline Report

**Date:** 2026-11-05
**Branch:** `perf/schedule-absence-tab-lag`
**Head at start:** `cebc170` (`perf(schedule,leave): fix calendar/absence tab lag`)
**Mode:** Application integration work on top of the Phase 5A–5H additive schema. No production touch, no deployment, no migration rewrites.

## Repository state at start (`git status --short`)

Pre-existing modified (user WIP, preserved): `.env.example`, `apps/web/next.config.ts`, `apps/web/package.json`,
`apps/web/src/app/layout.tsx`, `apps/web/src/instrumentation.ts`, `apps/web/src/components/actions/absences-tab.tsx`,
`apps/web/src/components/layout/workspace-nav.tsx`, `apps/web/src/lib/db/leave.ts`, `apps/web/src/lib/security/csp.ts`,
`apps/web/src/types/database.ts`, `apps/web/src/types/database.generated.ts`, `apps/web/tests/unit/csp.test.ts`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`.

Pre-existing untracked (user WIP + prior phases, preserved): `apps/web/src/app/(workspace)/university-info/`,
`apps/web/src/app/global-error.tsx`, `apps/web/src/components/analytics/`, `apps/web/src/features/plugins/`,
`apps/web/src/lib/observability/sentry-env.ts`, `apps/web/src/sentry.*.config.ts`, `apps/web/tests/unit/sentry-env.test.ts`,
`docs/architecture/phase-4c/`, `docs/architecture/phase-5-final-report.md`, `docs/architecture/phase-5a/` … `phase-5h/`,
`docs/database/`, `docs/engineering/`, `scripts/cli/`, `scripts/ingest-kc117-*`, all `supabase/migrations/202611*`, `supabase/tests/`.

## WIP migration quarantine

`supabase/migrations/20261110000000_subject_enrollment.sql` is WIP (class→subject membership with automatic backfill).
**Never executed, never edited.** SHA-256 at baseline: `59CE5DAF8AFEB3E9D0FD2624BC19F762FC5C71D3F69A2D693A172C93142ECEC3`.
Phase 5I must not depend on it; no verification was run against it.

## Tooling at baseline

- Node/pnpm workspace; direct `npx` tools used (pnpm script runner is blocked by the known `approve-builds` state).
- `apps/web` scripts: `build`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
- `packages/contracts` (`@starstask/contracts`) holds Zod schemas; `packages/shared` shared helpers.
- Phase 5H baseline: **1079 tests passed (94 files)**, `tsc --noEmit` exit 0. (To be re-verified after 5I changes; see test-validation-report.md.)
- No database was started or queried during this phase. Local schema parity is **NOT VERIFIED**; claims about DB behavior come from migration files on disk (read-only inspection).

## Architecture facts verified on disk

- **Auth:** Google OAuth with PKCE via Supabase (`app/auth/callback`, `proxy.ts`, `lib/supabase/server.ts`). Server Components/route handlers use the request-scoped cookie client; anonymous reads are impossible for new tables (RLS revoke + `is_university_member` / `is_platform_admin` predicates).
- **Admin console exists:** `app/(console)/admin/*` gated by `requirePlatformAdmin` (`lib/auth/admin.ts` → `is_platform_admin()` RPC on the caller's own session).
- **New 5A–5G tables have SELECT-only RLS for `authenticated`; zero client write policies.** All writes must flow through (a) the single platform-admin RPC `platform_upsert_student_identity`, or (b) service-role server code that performs its own authorization (pattern already used by the reminder scheduler: `lib/supabase/admin.ts`, server-only, `SUPABASE_SERVICE_ROLE_KEY` never exposed client-side).
- `has_class_permission(class_id, permission)` (8 permission codes) is granted to `authenticated` and is the sanctioned class-RBAC predicate. `guard_last_class_admin` trigger enforces ≥1 active admin per class at the DB layer.
- New tables are inert in any environment until a platform operator assigns `classes.university_id` and creates memberships: legacy classes have `university_id NULL`, and composite FKs (`MATCH SIMPLE`) reject cross-university rows only when both sides are set. Nothing in 5I creates memberships, activates universities, or backfills.
- `universities` RLS exposes **status = 'active' rows only** to authenticated users (including platform admins). Non-active registry rows are unreadable without service_role — deliberately not bypassed in 5I.
- Notifications outbox (`notification_events` / `notification_deliveries`) is already wired end-to-end (list, unread filter, mark-read RPC, safe `href` navigation). 5I reuses it; no duplicate pipeline is built.

## What 5I builds on top

New server-side identity context, university selection (read-only), academic structure reads, enrollment/RBAC administration, normalized attendance workflow, read-only grading/scheduling views, class-scoped announcements, plus negative-path unit tests. See `decision-register.md` for the decisions carried forward and `phase-5i-final-report.md` for per-domain verdicts.
