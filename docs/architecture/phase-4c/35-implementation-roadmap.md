# 35 — Implementation Roadmap (Phases 5A–5I)

> **Status:** DRAFT / PROPOSED. Each phase: objective / scope / deps / tables / app impact / security / migration risk / testing / acceptance / rollback.

## 5A — Evidence closure (pre-work)

- Objective: close UNKNOWNs (live catalog, attendance statuses, class-media storage policy, `rls_auto_enable` presence, backup/restore timing).
- Scope: catalog queries (row counts, sizes, seq scans, FK/policy/function counts, grants), read attendance migrations line-by-line.
- Deps: staging access + owner approvals. Tables: none. App impact: none. Security: read-only. Risk: LOW. Testing: reproduce `02` numbers. Acceptance: all REPORTED claims re-verified or corrected. Rollback: n/a.

## 5B — Tenant core (Domains B/E)

- Objective: `universities` + `student_identities` + backfill.
- Scope: NEW tables; identity bridge; NIM de-globalization.
- Deps: 5A. Tables: `universities`, `student_identities`. App: onboarding writes identity. Security: Platform-Admin-only universe writes. Risk: HIGH (identity bridge). Testing: tenant-isolation suites. Acceptance: per-tenant NIM uniqueness works; legacy values mapped/audited. Rollback: drop NEW tables pre-cutover.

## 5C — Class & course model (Domains F/G/C/D)

- Objective: classes/memberships/offerings/enrollments + units/periods.
- Scope: MODIFY classes, MERGE subjects→offerings, RENAME members→enrollments; NEW units/periods.
- Deps: 5B. Tables: `classes`, `class_memberships`, `course_offerings`, `enrollments`, `academic_units`, `academic_periods`. App: class pages. Security: composite FKs + RLS. Risk: HIGH (re-keying). Testing: home-class + retake suites. Acceptance: retake enrollment works without home-class change. Rollback: dual-write flip.

## 5D — Invitations & RBAC (Domains H/I)

- Objective: course invite tokens + normalized admin permissions.
- Scope: NEW token tables; SPLIT `class_admins`.
- Deps: 5C. Tables: `course_invite_tokens`, `course_invite_acceptances`, `class_admin_assignments`, `class_admin_permissions`. App: invite link UI. Security: hash-only tokens; last-admin trigger. Risk: MEDIUM. Testing: redeem/revoke/expiry suites. Acceptance: invite enrolls without approval, no home-class change. Rollback: disable RPCs.

## 5E — Attendance & schedule (Domains K/M)

- Objective: explicit meetings + rules/instances/exceptions.
- Scope: NEW meetings; RENAME records/corrections; SPLIT schedules.
- Deps: 5C. Tables: `attendance_meetings`, `attendance_records`, `attendance_corrections`, `schedule_rules`, `schedule_instances`, `schedule_exceptions`. App: attendance board, calendar. Security: manage_attendance/admin scope. Risk: MEDIUM. Testing: correction history + instance idempotency. Acceptance: export parity (Excel/PDF). Rollback: old checkins live.

## 5F — Grading (Domain L)

- Objective: CSV import pipeline.
- Scope: NEW batches/entries/history; import services.
- Deps: 5C + CSV format sign-off. Tables: `grade_batches`, `grade_entries`, `grade_history`. App: upload/verify/publish UI. Security: manage_grades-gated. Risk: MEDIUM (new surface). Testing: verify→publish→correction suites. Acceptance: history append-only. Rollback: disable endpoint.

## 5G — Cross-cutting (Domains A/J/N/O/P/Q)

- Objective: profile deprecation, assignments/materials scoping, announcements, notification/audit tenancy.
- Scope: MODIFY assignments/materials/notifications/audit; NEW announcements.
- Deps: 5B–5F. App: feeds, notifications. Security: tenant predicates. Risk: LOW. Testing: RLS matrix rerun. Acceptance: no client `university_id` trust. Rollback: per-phase flips.

## 5H — Hardening (security/perf)

- Objective: definer grant narrowing, index adds, storage prefixing.
- Scope: revoke over-broad EXECUTE; add justified indexes; path prefix migration.
- Deps: 5A–5G. Risk: MEDIUM. Testing: perf scenarios + isolation rerun. Acceptance: benchmarks recorded. Rollback: restore grants/indexes.

## 5I — Cutover & contract

- Objective: drop legacy columns/tables per expand-contract.
- Scope: contract migrations; final audits.
- Deps: 5H. Risk: LOW (post-green). Testing: full suites. Acceptance: acceptance checklists (5B–5H) green. Rollback: re-expand (rare).
