# Schema parity — Phase 5J

> **Generated:** 2026-11-05. **Read-only.** No migration, reset, or backfill was executed.
> **Status: FAIL — repository, local, and production are not aligned.**

## 1. Summary

| Plane                                                              | Evidence                                                                                                                                                           | Result                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Repo migrations                                                    | 90 files in `supabase/migrations` (latest `20261117000000_hardening.sql`)                                                                                          | Source of intended schema                                      |
| Local Supabase DB                                                  | 77 tables; 792 columns; 279 indexes; 108 public policies; 164 functions; 56 non-internal triggers; migration ledger `max(version)=20261109000000`, 82 applied rows | Contains Phase 5A–5G objects **without migration ledger rows** |
| Production                                                         | 52 tables; 175 indexes; 83 public policies; 159 functions; 40 triggers; migration ledger `max(version)=20261109000000`, 82 applied rows                            | **Unchanged Phase 4 baseline; Phase 5A–5G absent**             |
| `20261110000000_subject_enrollment.sql`                            | absent from both ledgers                                                                                                                                           | unapplied / quarantined                                        |
| Phase 5A–5G migrations (`20261111000000` through `20261117000000`) | present in repo and materialized in local DB schema                                                                                                                | absent from production; local ledger does not record them      |

## 2. Exact object differences (local vs production)

Local has these 25 tables that production does not:

`universities`, `university_memberships`, `student_identities`, `academic_units`, `academic_years`, `semesters`, `course_offerings`, `enrollments`, `schedule_rules`, `schedule_instances`, `schedule_exceptions`, `class_memberships`, `course_invite_tokens`, `course_invite_acceptances`, `class_admin_assignments`, `class_admin_permissions`, `attendance_meetings`, `attendance_records`, `attendance_corrections`, `grade_batches`, `grade_entries`, `grade_history`, `announcements`, `announcement_reads`, `discussion_threads`.

Difference counts:

| Metric                     | Local | Production | Delta |
| -------------------------- | ----: | ---------: | ----: |
| tables                     |    77 |         52 |   +25 |
| columns                    |   792 |        535 |  +257 |
| foreign keys               |   206 |        112 |   +94 |
| unique constraints         |    24 |         18 |    +6 |
| check constraints          |   320 |        250 |   +70 |
| indexes                    |   279 |        175 |  +104 |
| public functions           |   164 |        159 |    +5 |
| SECURITY DEFINER functions |   147 |        143 |    +4 |
| non-internal triggers      |    56 |         40 |   +16 |
| public policies            |   108 |         83 |   +25 |

## 3. Migration ledger parity failure

Direct catalog query on both databases reported:

- `local: max(version)=20261109000000`, `applied=82`
- `production: max(version)=20261109000000`, `applied=82`

If a migration recorded by Supabase is missing/misaligned, local test results do not evidence production correctness. The 5A–5G object count in local proves the working database was materially changed by running migration SQL out-of-ledger, not by an authoritative pipeline.

**Consequence:** full schema parity is not verified. Any staging clone must be built from committed migrations with `supabase` pipeline semantics, not from the ad-hoc local working DB.

## 4. Repository → production deployment gap

Committed or pending Phase 5 migrations include:

- `20261111000000_universities_and_memberships.sql`
- `20261112000000_identity_bridge.sql`
- `20261113000000_academic_structure.sql`
- `20261114000000_enrollment_admin.sql`
- `20261115000000_ops.sql`
- `20261116000000_communication.sql`
- `20261117000000_hardening.sql`

None are authorized or recorded in production. `20261110000000_subject_enrollment.sql` is also unapplied in both local and production and must remain quarantined.

## 5. What would verify parity

1. Create isolated staging DB from committed migration files with the project’s actual migration pipeline.
2. Apply through `20261117000000_hardening.sql` explicitly; do not apply `20261110000000`.
3. Query catalog counts and object names; compare local snapshots to staging.
4. Regenerate `apps/web/src/types/database.generated.ts` from staging after parity.
5. Confirm every table has RLS enabled and anon denied before activation.
6. Verify empty/inert product states; no legacy backfill until ADR-002 decision.

## 6. Blockers

| Blocker                             | Impact                                              | Required action                                                   |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| No verified staging environment     | Cannot execute 5K/5L/5M runtime validation honestly | Owner to provide isolated staging DB / clone                      |
| Local DB changed out-of-ledger      | Local evidence is not authoritative pipeline output | Rebuild staging from migrations; do not use local as parity proof |
| Production unapplied Phase 5 schema | No production readiness claim                       | Platform/Product sign-off + staged deploy plan                    |
| WIP migration quarantined           | Must not be in deploy sequence                      | Keep excluded                                                     |

## 7. Verdict

**NO-GO for production tenant activation or scale benchmark on current evidence.**

No schema changed by this phase. Existing uncommitted work is preserved.
