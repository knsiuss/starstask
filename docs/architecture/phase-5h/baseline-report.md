# Phase 5H — Baseline Report

**Date:** 2026-11-04
**Mode:** Read-only audit (this task)
**Branch:** `perf/schedule-absence-tab-lag`
**Head:** `cebc170`

## Repository state

`git status --short` (recorded before audit, unchanged except this directory):

- pre-existing modifications: `.env.example`, `apps/web/next.config.ts`, `apps/web/package.json`,
  `apps/web/src/app/layout.tsx`, `apps/web/src/components/actions/absences-tab.tsx`,
  `apps/web/src/components/layout/workspace-nav.tsx`, `apps/web/src/instrumentation.ts`,
  `apps/web/src/lib/db/leave.ts`, `apps/web/src/lib/security/csp.ts`, `apps/web/src/types/database.generated.ts`,
  `apps/web/src/types/database.ts`, `apps/web/tests/unit/csp.test.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- pre-existing untracked WIP: `apps/web/src/app/(workspace)/university-info/`, `apps/web/src/app/global-error.tsx`,
  `apps/web/src/components/analytics/`, `apps/web/src/features/plugins/`, sentry/CSP/testing files,
  `docs/database/`, `docs/engineering/`, `scripts/`, plus all `supabase/migrations/202611*`.
- `docs/architecture/phase-5h/` created by this audit only.
- `20261110000000_subject_enrollment.sql` is WIP: class→subject membership with automatic backfill of
  every current member into every subject. **Not verified as applied; must not be run as part of this audit.**

Branch: `perf/schedule-absence-tab-lag`. Purpose: performance fixes. This audit does not merge or modify it.

## Migrations

~83 migrations verified on disk. Exact order: `20261029000100` … `20261117000000`.

Phase migrations:

| File                                              | Status on disk          | Locally applied?       | Validated?                                               | Production?  |
| ------------------------------------------------- | ----------------------- | ---------------------- | -------------------------------------------------------- | ------------ |
| `20261110000000_subject_enrollment.sql`           | Present (untracked WIP) | UNKNOWN                | No audit execution                                       | NOT DEPLOYED |
| `20261111000000_universities_and_memberships.sql` | Present                 | REPORTED by 5A         | REPORTED (11 smoke checks)                               | NOT DEPLOYED |
| `20261112000000_identity_bridge.sql`              | Present                 | REPORTED by 5B         | REPORTED (30 checks)                                     | NOT DEPLOYED |
| `20261113000000_academic_structure.sql`           | Present                 | REPORTED by 5C         | `supabase/tests/phase5c-5g-validation.sql` REPORTED PASS | NOT DEPLOYED |
| `20261114000000_enrollment_admin.sql`             | Present                 | REPORTED (same script) | REPORTED PASS                                            | NOT DEPLOYED |
| `20261115000000_ops.sql`                          | Present                 | REPORTED PASS          | same                                                     | NOT DEPLOYED |
| `20261116000000_communication.sql`                | Present                 | REPORTED PASS          | same                                                     | NOT DEPLOYED |
| `20261117000000_hardening.sql`                    | Present                 | REPORTED PASS          | same                                                     | NOT DEPLOYED |

**No live database or `supabase status` start was used** — local stack is stopped and was not started.
`psql` is not on PATH. Therefore current local schema parity is **NOT VERIFIED**. Claims marked REPORTED come
from prior phase reports, not from independent execution in this audit.

## Tooling

- `npx vitest run` → **1079 passed (94 files)** on this session, 2026-11-04.
- `npx tsc --noEmit` → **exit 0**.
- No migration applied during this audit.
- `pnpm` blocked by known `approve-builds` state; direct tools used.

## Execution constraints

Read-only. No feature work, no migrations, no RLS/schema/type changes, no deploys. Any unverified claim is
marked as such rather than assumed.
