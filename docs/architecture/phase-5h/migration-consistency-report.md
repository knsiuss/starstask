# Phase 5H — Migration Consistency Report

## States (per migration)

| File                                    | On disk             | Locally applied    | Validated | Deployed |
| --------------------------------------- | ------------------- | ------------------ | --------- | -------- |
| `20261110000000_subject_enrollment.sql` | Yes (untracked WIP) | UNKNOWN            | No        | No       |
| `..._universities_and_memberships.sql`  | Yes                 | REPORTED (5A psql) | REPORTED  | No       |
| `..._identity_bridge.sql`               | Yes                 | REPORTED (5B psql) | REPORTED  | No       |
| `..._academic_structure.sql`            | Yes                 | REPORTED (5C psql) | REPORTED  | No       |
| `..._enrollment_admin.sql`              | Yes                 | REPORTED           | REPORTED  | No       |
| `..._ops.sql`                           | Yes                 | REPORTED           | REPORTED  | No       |
| `..._communication.sql`                 | Yes                 | REPORTED           | REPORTED  | No       |
| `..._hardening.sql`                     | Yes                 | REPORTED           | REPORTED  | No       |

**Drift control:** types regenerated from an applied local database per `phase-5b/…/migration-validation-report.md` (`node scripts/generate-db-types.mjs`). Generated content includes all 5A–5G tables (verified counts of mentions > 0). Parity is **not re-checkable here** because local stack was not started in this audit.

## Ordering and dependencies

- 202611110 → 5A universals → referenced by everything else. OK.
- 202611120 → academic_units/student_identities → must precede 20261113/14 (FKs). OK.
- 20261113 classes/course_offerings/enrollments → required by 20261114/15/16/17. OK.
- 20261114 class_memberships/class_admin_assignments depend on 20261113 + 20261112. OK.
- 20261115 attendance/grade depend on 20261112/13. OK.
- 20261116 announcements/notifications depend on 20261113/14 families. OK.
- 20261117 audit + indexes depend on all prior new tables. OK.
- Cross-file dependency check passed (FK requirements satisfied by earlier files).

## Idempotency

- All new Phase migrations use `CREATE TABLE IF NOT EXISTS` / `ALTER … ADD COLUMN IF NOT EXISTS` / named `DO`-guarded constraint adds / `DROP TRIGGER IF EXISTS` before recreation. Re-running on an empty DB yields consistent object set.
- Existing pre-phase files were not edited (expand-only) — VERIFIED from git diff of `supabase/migrations` in this branch; nothing pre-branch was touched by this task.
- Triggers recreated after drop → idempotent.
- Partial indexes `IF NOT EXISTS` with same name — safe.
- One `CREATE UNIQUE INDEX` uses `COALESCE(semester_id, '00000000-…')` sentinel — must be revisited if semester_id semantics change (not breaking today).

**Caveat:** idempotent DDL ≠ idempotent data. `20261110000000` is **not** idempotent for data backfill (`INSERT … SELECT` has no conflict target) — must be applied exactly once and dry-run verified.

## Constraints, indexes, uniqueness

- Composite MATCH SIMPLE FKs for tenant pairs: intended to allow NULL parents; OK.
- Unique partial indexes: one-current-year, one-home-class, active enrollment/invite/RBAC — reviewed for duplicate-active races; single-statement DDL remains race-prone unless a unique index guards the active row (it does, `*_active_unique` / `*_one_home`).
- Foreign keys have supporting indexes (uniqueness is enforced via unique indexes that create implied indexes).
- Non-unique indexes exist for `class_memberships(class_id, left_at)`, `academic_years(university_id, status)` etc.; acceptable.

## WIP migration 20261110000000

- Content: `class_subject_members` + backfill of existing members into subjects + auto-enrolment of new members/subjects.
- **Data mutability:** modifies production-equivalent semantics if applied; introduces a second membership model alongside `class_memberships` (5D).
- **Conflicts:** does not reference `universities.id` nor `university_id`, is not tenant-aware, and its backfill could silently enroll students in subjects — a product decision that must be approved, not discovered.
- **Recommendation:** do not apply. Redesign as Phase 5I scope with university-scoped migration or defer to a dedicated migration after Phase 5I approval. Treat as reference only.

## Schema parity

Cannot be asserted from this machine because local DB was not started and `psql` is unavailable. Any claim of "applied and validated" comes from prior phase evidence under REPORTED. No remote verification was performed.

## Rollback

All five Phase files are additive → child-first drops restore prior schema exactly (documented per phase). No data loss to legacy tables. Rollback remains impossible to guarantee for `20261110000000` because it backfills mass rows.
