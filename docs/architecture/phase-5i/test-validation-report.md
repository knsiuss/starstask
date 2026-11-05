# Phase 5I — Test & Validation Report

**Date:** 2026-11-05 · **Branch:** `perf/schedule-absence-tab-lag` · **Mode:** no DB started; no staging; production untouched.

## Commands actually run (true outputs)

| Command                       | Result                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` (apps/web) | **exit 0** (re-run after Prettier pass: exit 0)                                                                                                                                                                                                                                                                                          |
| `npx vitest run` (apps/web)   | **98 files / 1115 tests passed** (baseline 1079 → +36 new; duration ~7.5–17.7s)                                                                                                                                                                                                                                                          |
| `npx eslint .` (apps/web)     | **2 errors + 1 warning — none in files touched by 5I.** Flagged: `components/attendance/attendance-correction-dialog.tsx` (pre-existing), `components/onboarding/onboarding-welcome.tsx` (pre-existing), warning in `features/plugins/unpam/adapter.ts` (user WIP, untouched). All 5I files lint clean (verified by scoped run, exit 0). |
| `npx next build` (apps/web)   | **exit 0** — "✓ Compiled successfully in 5.7s"; all new routes present (`/university`, `/admin/invitations`, `/dashboard/classes/[slug]/academic/*` + 11 API routes)                                                                                                                                                                     |
| `npx prettier --check`        | **All matched files use Prettier code style!** (full list of 5I files verified)                                                                                                                                                                                                                                                          |

## New unit tests (36 tests, all green)

| File                                    | Covers                                                                                                                                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/identity-context.test.ts`   | 12-case decision table: missing profile, no membership, pending/suspended/graduated, **multi-membership never auto-picks**, inactive university (missing/suspended row), missing identity, cross-membership identity ignored, mixed active+suspended |
| `tests/unit/academic-unit-tree.test.ts` | Tree nesting, orphan-to-root, sibling sorting, depth flatten semantics                                                                                                                                                                               |
| `tests/unit/timezone.test.ts`           | UTC fallback for missing/invalid zones, zone-labeled formatting, ISO weekday names, window trimming                                                                                                                                                  |
| `tests/unit/academic-schemas.test.ts`   | Zod bounds: academic year (date order, code length), admin grant (xor target, ≤8 codes, unknown code rejected), roster upsert (`not_applicable` rejected, empty rejected), correction reason ≥3 chars, announcement title bounds/defaults            |

## What is NOT verified (explicitly)

- **No live database tests.** Local stack was not started; `psql` unavailable; zero migrations executed (by instruction: WIP quarantine + additive-only). RLS behavior is verified by **policy source reading**, not execution.
- **Cross-university denial, wrong-class admin denial, anonymous denial**: implemented (RLS + gates) but **not executed end-to-end** in this phase.
- **Tenant isolation results: code-reviewed only.** Composite FKs, `is_university_member`/`is_platform_admin`, owner-read policies, and per-route tenant re-validation were inspected; no synthetic A/B run occurred.
- **Service-role write paths** (grant/revoke/attendance/announcements/academic-year create/invite revoke) were **not** executed against a live DB; they type-check, lint, and are audit-wired but untested at runtime. Risk mitigated by: single-tenant service-role usage, explicit tenant filters, composite-FK backstop, 503 fail-closed, audit-on-write.
- **Build does not connect to Supabase** (all new pages are `force-dynamic`; setup-notice path renders without env).

## Regression evidence

- Baseline: 1079 tests / 94 files → now **1115 / 98** (+4 files, +36 tests).
- No existing test was modified; `tests/unit/csp.test.ts` etc. remain user-WIP untouched.
- Legacy flows (assignments, attendance, leave, classes) show zero behavioral change; nothing in 5I rewrites or reorders queries on those paths.

## Fixes of pre-existing type drift (minimal, disclosed)

- `types/database.ts`: added `has_class_permission`, `is_university_member` to `Functions`; added `audit_logs.university_id` to `Insert`; fixed `classes.entry_year` `string | null` → `number | null` (matches migration + generated types).
- **Prettier reformatted the whole handwritten `types/database.ts`** (it was user-WIP): formatting-only — verified that **every deleted line reappears in the additions** (0 unmatched). No content removed. tsc + 1115 tests + build all pass after the reformat.

## WIP migration quarantine

`supabase/migrations/20261110000000_subject_enrollment.sql` — SHA-256 before and after this phase:
`59CE5DAF8AFEB3E9D0FD2624BC19F762FC5C71D3F69A2D693A172C93142ECEC3` — **unchanged, never executed, never edited.**
