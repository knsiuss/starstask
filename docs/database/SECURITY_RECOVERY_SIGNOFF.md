# Security & Recovery Gate — Sign-off (Phase 3)

Status definitions: VERIFIED / INCOMPLETE / BLOCKED / FAILED / NOT APPLICABLE. Never mark complete when objects were not inspected.

## 1. Backup verification — **BLOCKED**

- Snapshot `backup_20261104` (52 data-only tables) exists but is not a recovery point.
- `pg_dump` NOT FOUND on this workstation (`where.exe` no match; `C:\Program Files\PostgreSQL\18` = data dir only, no `bin/`). Client version UNKNOWN. No dump, no SHA-256, no `pg_restore --list`.
- Owner instructions to finish it are in `backup/BACKUP_VERIFICATION.md` (run on a PG17-client machine, store dump outside repo, then record hash).
- **Gate: Phase 4 cannot start on backup grounds until owner completes this and marks it VERIFIED with evidence.**

## 2. Restore test — **INCOMPLETE**

- Not performed (depends on BLOCKED dump). Isolated DB target, never prod. Steps in `backup/RESTORE_RUNBOOK.md`.

## 3. RLS review — **VERIFIED inventory / INCOMPLETE exploit test**

- 83 public policies + 18 storage policies captured verbatim; all 52 tables RLS-enabled; auth helpers bind `auth.uid()` server-side.
- Findings: `class_course_schedules` member-write is wider than admin-only peers (P1 decision); `class_subjects`/`classes` active rows world-readable (catalogue intent, cross-tenant leak later); no `USING(true)` beyond intentional `courses`/`profiles` public reads.
- Exploit-level cross-class testing not done (needs staging fixtures) — see test plan below.

## 4. SECURITY DEFINER — **INCOMPLETE**

- 143/143 functions declare `search_path`; 1 dynamic-SQL function (`rls_auto_enable`, NOT VERIFIED).
- Signatures+counts VERIFIED; auth-helper bodies (4) VERIFIED; remaining ~139 bodies + EXECUTE grants NOT VERIFIED.

## 5. Storage — **INCOMPLETE**

- 5 buckets, 2 public; object counts 11 total (`class-media` 0).
- P1: `class-media` public read with no object restriction (0 objects today; owner to confirm logo-only vs make private).

## 6. Critical vulnerabilities

None confirmed exploitable today from the evidence gathered. The two items that would become critical if mis-decided: (a) flipping `class-media` to private is a one-line owner decision — leaving it public while storing student photos would expose PII; (b) member-write on `class_course_schedules` if the product expects admin-only.

## 7. Required remediations (no change made in Phase 3)

1. Owner: full `pg_dump` + SHA-256 + isolated restore (unblocks gate).
2. Owner: confirm `class-media` content policy (logo-only → keep public; human photos → make private + signed URLs).
3. Product: confirm `class_course_schedules` member-edit intent.
4. Phase 4: capture `pg_get_functiondef` for all 143 bodies + EXECUTE grants; dump `pg_policies` per table; run test plan below on staging.
5. Phase 4: standardize `can_view_leave_request` search_path to `''`.

## 8. Remaining blockers

- BLOCKED: full logical backup (no pg_dump here).
- INCOMPLETE: isolated restore, secdef body review, storage content review, test-plan execution.
- UNKNOWN: PITR status (dashboard), pg_cron purge jobs, per-bucket PII sampling.

## 9. Go / No-Go — **NO-GO for Phase 4 scaling implementation**

- **NO-GO** until (a) backup VERIFIED with isolated restore, and (b) secdef body + grant review complete. Reason: no verified recovery point + 143-function surface not line-reviewed.
- **GO** only for read-only Phase 4 prep (function dumps, staging fixtures, test-plan dry run) without any production DDL.

## Security Test Plan (staging-only, never prod)

Fixtures: 2 universities (U1/U2) × 2 classes (C1 in U1, C2 in U1) × users: `student_A` (C1), `admin_A` (C1), `student_B` (C2), `student_X` (U2), `anon`, `outsider` (no class).

| # | Test | Expected |
|---|---|---|
| T1 | `anon` reads `courses`, `profiles`, `classes` (active), `assignments` (public) | Allowed (catalogue) |
| T2 | `anon` reads 11 private-bucket objects / `leave-evidence` | Denied |
| T3 | `student_B` reads `class_members` of C1; unauthenticated bucket read of `class-media` object (if any) | Denied / read-only per policy doc |
| T4 | `student_X` (cross-university) reads C1 `leave_requests`, `discussion_sessions`, `course_materials` | Denied (fails today if university column absent — documents gap) |
| T5 | `student_A` calls `delete_class`, `delete_class_subject`, `assign_class_admin` with C1 id | Denied (must be admin) |
| T6 | `student_B` calls `record_attendance_correction` / `check_in_attendance_meeting` with C1 session id | Denied / geofence error, not success |
| T7 | `student_A` uploads `leave-evidence` to another uid's folder path | Denied |
| T8 | `admin_A` writes `course_materials` for C2 | Denied |
| T9 | Each SECURITY DEFINER mutator invoked with foreign `p_class_id` | Denied at function level AND RLS level |
| T10 | `anon` executes `consume_rate_limit` / `purge_*` | Denied (internal RPC guard) |

All tests run against isolated staging with synthetic data; destructive tests forbidden on prod. Evidence = SQL returning 0 rows / RPC error for unauthorized cases.

## STOP

Phase 3 complete. No DDL, RLS, function, bucket, or data change was made. Uncommitted changes preserved. Wait for owner approval (backup handoff + `class-media` decision) before Phase 4.
