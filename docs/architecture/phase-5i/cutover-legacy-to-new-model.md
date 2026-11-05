# Cutover: legacy class_members/class_admins -> class_memberships/class_admin_assignments

**Date:** 2026-11-05
**Status:** PLAN — not yet switched. Legacy remains source of truth for `is_class_member()` / `is_class_admin()`.

## Current state (verified 2026-11-05)
- Legacy: `class_members` 32 rows, `class_admins` active. All attendance, RLS, and app read paths use legacy.
- New: `class_memberships` 31 rows (UNPAM backfill), `class_admin_assignments` 0 rows.
- Subject enrollment (WIP 20261110) is now live: `class_subject_members` 256 rows (32x8), attendance check-in requires per-subject enrollment when `subject_id IS NOT NULL`.
- Academic backfill live: 1 unit, 1 year, 1 semester, 8 offerings, 248 enrollments.

## Cutover steps (expand-contract, each gated)
1. **Dual-write (next):** trigger on `class_members` INSERT/DELETE -> mirror to `class_memberships` via identity bridge. Backfill reconciliation report must show 0 drift for 7 days.
2. **Admin mirror:** migrate `class_admins` -> `class_admin_assignments` + `class_admin_permissions` with explicit permission mapping. No auto-guess of permissions.
3. **Read switch:** change `is_class_member()` to read `class_memberships` (with legacy fallback during transition), behind a feature flag. Measure RLS denial rate.
4. **Deprecate:** after 30 days zero legacy reads, mark legacy tables deprecated (already commented in 20261119000002), then drop in a separate migration with rollback plan.

## Rollback
- Each step is additive. Rollback = revert trigger / flag, legacy tables untouched until final drop.
- Final drop requires: backup, 30-day observation, owner ADR sign-off.

## Blockers
- NIM dual-write (see ADR-002 §5)
- Admin permission mapping (needs owner input)
- 2-university negative test on staging branch (cost $0.01344/hr — pending user confirm)
