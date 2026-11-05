# Database inventory — Phase 5J

> **Generated:** 2026-11-05 under Phase 5J. **Read-only.**
> **Local evidence:** docker `supabase_db_starstask`, database `postgres`, PostgreSQL 17.11.
> **Production evidence:** project `starstask` (ref `kdqsrckmmoucdqiapovr`) via read-only `execute_sql`.
> **Do not use local row counts for production capacity planning.** Local schema is almost empty; see `schema-parity.md`.

## 1. Inventory summary

| Item                                            | Local (Phase 5 working DB) |  Production (live) | Status                  |
| ----------------------------------------------- | -------------------------: | -----------------: | ----------------------- |
| Public base tables                              |                         77 |                 52 | **DRIFT**               |
| Public columns                                  |                        792 |                535 | **DRIFT**               |
| Primary keys                                    |                         77 |                 52 | Match count of tables   |
| Foreign keys                                    |                        206 |                112 | **DRIFT**               |
| Unique constraints                              |                         24 |                 18 | **DRIFT**               |
| Check constraints                               |                        320 |                250 | **DRIFT**               |
| Total public constraints                        |                        627 |                432 | **DRIFT**               |
| Indexes (public)                                |                        279 |                175 | **DRIFT**               |
| RLS policies (public)                           |                        108 |                 83 | **DRIFT**               |
| SECURITY DEFINER functions                      |                        147 |                143 | **DRIFT**               |
| Public functions                                |                        164 |                159 | **DRIFT**               |
| Non-internal triggers (public)                  |                         56 |                 40 | **DRIFT**               |
| Composite/auto types (public `typtype='c'`/`b`) |   not re-counted this pass | 52 / 52 (all auto) | Known from Phase 4A     |
| Public views / materialized views               |                          0 |                  0 | Verified                |
| Storage buckets                                 |                not changed |                  5 | Verified previous phase |
| RLS-enabled public tables                       |             77 (all local) |            52 / 52 | Verified                |
| RLS FORCED                                      |                          0 |                  0 | Verified                |

## 2. Local table classes

### 2.1 Original 52 tables still present

All original names listed in Phase 4A inventory exist locally:

`app_activity_events`, `app_error_events`, `assignment_attachments`, `assignment_completions`, `assignment_reports`, `assignment_reviews`, `assignment_revisions`, `assignments`, `attendance_correction_audits`, `attendance_verification_attempts`, `audit_logs`, `auth_activity_events`, `class_admins`, `class_application_reviews`, `class_applications`, `class_calendar_events`, `class_course_schedules`, `class_invitation_acceptances`, `class_invitation_declines`, `class_invitations`, `class_members`, `class_subjects`, `class_verification_evidence`, `class_verification_requests`, `class_verification_reviews`, `classes`, `course_materials`, `courses`, `developer_incident_notes`, `developer_incidents`, `discussion_session_checkins`, `discussion_session_reminders`, `discussion_session_rsvps`, `discussion_sessions`, `feedback_entries`, `google_calendar_connections`, `google_calendar_event_mappings`, `leave_lecturer_outcomes`, `leave_request_evidence`, `leave_request_forwarding_items`, `leave_request_forwardings`, `leave_request_history`, `leave_requests`, `notification_deliveries`, `notification_events`, `notification_preferences`, `personal_calendar_events`, `platform_admins`, `profiles`, `push_subscriptions`, `rate_limits`, `saved_assignments`.

### 2.2 New positional Phase 5 tables in local only (25)

Not present in production; do not query production for them as if they exist:

`universities`, `university_memberships`, `student_identities`, `academic_units`, `academic_years`, `semesters`, `course_offerings`, `enrollments`, `schedule_rules`, `schedule_instances`, `schedule_exceptions`, `class_memberships`, `course_invite_tokens`, `course_invite_acceptances`, `class_admin_assignments`, `class_admin_permissions`, `attendance_meetings`, `attendance_records`, `attendance_corrections`, `grade_batches`, `grade_entries`, `grade_history`, `announcements`, `announcement_reads`, `discussion_threads`.

### 2.3 WIP migration not applied

`20261110000000_subject_enrollment.sql` remains **unapplied** locally and in production (`class_subject_members` absent locally; table absent in repo ledger).

## 3. Local workload snapshot

Local in-container sizes differ from production because the working DB has the 5A–5G surfaces created for testing and is otherwise near-empty. Local estimates observed:

- Largest local index allocation visible in table dump: `assignments` ~229 KB, `classes` ~147 KB, `university_memberships` ~98 KB, `student_identities` ~82 KB, `enrollments` ~82 KB, `academic_years` ~74 KB, `courses` ~57 KB, `university_memberships` ~98 KB.
- Local database size was 17 MB before the Phase 5 schema materialization; not a production metric. Re-measure after verified parity.

Production snapshot available from prior Phase 4A/4B read-only inspection:

- DB size ~19 MB; public application data ~3.4 MB.
- Production row counts are estimate-only in earlier docs (e.g. `profiles` ~26, `class_members` ~23, `discussion_session_checkins` ~121). Exact production counts were not pulled this pass to avoid relying on load-bearing assumptions; earlier docs already treat local counts as insufficient.
- Live tables are small; this is not evidence of future scale.

## 4. High-growth candidate domains

Likely high-growth in order of expectation, based on application role rather than row count:

1. `audit_logs` — append-only records; risk of unbounded growth.
2. `discussion_session_checkins` / attendance corrections — event log growth.
3. `notification_events` / `notification_deliveries` — outbox processing.
4. `assignment_*` submissions + attachments — file and row growth.
5. New Phase 5 attendance records, audit events — currently empty, designed for growth.
6. `academic_units`, `semesters`, `course_offerings` — small reference, but high-read tenant-scoped lookup.

## 5. Relationship / indexing highlights

- No self-referencing FK detected in the inspected catalog (52 tables) previously; new Phase 5 tables require the same verification before activation.
- New tables use composite tenant-aware referential strategy (`id` + `university_id`) — additive only, not proven under load.
- FK coverage: exact number of unindexed FK columns not re-counted this pass; see `phase-5k-index-audit.md` follow-up when staging data exists.
- Composite PKs remain 4 in legacy schema (`class_members`, `class_admins`, `assignment_completions`, `leave_request_forwarding_items`); new Phase 5 tables use surrogate IDs + tenant-aware FKs.

## 6. RLS inventory

- Local working DB has RLS enabled on all public tables and 108 public policies; production has 83.
- No FORCE RLS; authorization relies on policies + SECURITY DEFINER gates.
- New tables are not production surfaces until verified activation path exists.
