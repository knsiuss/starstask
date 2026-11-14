# Schema Audit — StarsTask (52 public tables)

Evidence: `pg_tables` (52), `pg_constraint`, migrations `20261029000100_core_schema.sql` + follow-ups, `pg_stat_user_tables`.

## Table groups

| Group                 | Tables                                                                                                                                                                                                             | Purpose                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Identity              | `profiles` (32), `platform_admins` (0)                                                                                                                                                                             | Public identity, mirrors `auth.users` via trigger `handle_new_user`     |
| Classes               | `classes` (1), `class_members` (30), `class_admins` (4), `class_subjects` (8), `class_course_schedules` (0), `class_calendar_events` (1)                                                                           | Class = enrollment unit (not course); subjects (KC117) hang under class |
| Catalogue             | `courses` (12), `course_materials` (1)                                                                                                                                                                             | Course catalogue via `create_or_get_course()`                           |
| Discussion/attendance | `discussion_sessions` (14), `discussion_session_checkins` (129), `discussion_session_rsvps` (0), `discussion_session_reminders` (0), `attendance_correction_audits` (106), `attendance_verification_attempts` (55) | Attendance session = meeting; check-ins = attendance rows               |
| Assignments           | `assignments` (4), `assignment_*` (attachments/reviews/revisions/reports/completions)                                                                                                                              | Public assignment publishing                                            |
| Leave                 | `leave_requests` (3), `leave_request_*` (history 18, evidence 6, forwardings 0)                                                                                                                                    | Absence workflow                                                        |
| Notifications         | `notification_events` (7), `notification_deliveries` (0), `notification_preferences` (0), `push_subscriptions` (0)                                                                                                 | Event → delivery pipeline                                               |
| Calendar              | `google_calendar_connections` (0), `google_calendar_event_mappings` (0), `personal_calendar_events` (0)                                                                                                            | External calendar sync                                                  |
| Ops/telemetry         | `audit_logs` (288), `app_activity_events` (6), `app_error_events` (228), `auth_activity_events` (47), `developer_incidents` (0), `feedback_entries` (0), `rate_limits` (113)                                       | Audit + monitoring                                                      |
| Verification          | `class_verification_requests` (1), `class_verification_evidence` (0), `class_verification_reviews` (1), `class_applications` (0)                                                                                   | Class creation approval                                                 |
| Invitations           | `class_invitations` (9), `class_invitation_acceptances` (2), `class_invitation_declines` (0)                                                                                                                       | Invite flow                                                             |

## Constraints (measured)

- Foreign keys: 112 (48 tables have ≥1 FK). Strong referential spine: `profiles.id → auth.users`, `assignments.course_id → courses`, `class_members/class_admins → classes+profiles`, check-ins → sessions+profiles.
- Unique: 18. Notable: `discussion_session_checkins_one_per_user`, `class_subjects_class_code_uniq`, `assignment_reports_one_open_idx`, `profiles_nim_unique`, `notification_events_dedupe_key`, `save_assignment` user+assignment composite.
- Check: UNKNOWN full count (second query only returned unique count 18 due to multi-statement truncation) — NOT VERIFIED, fetch follow-up before migration design.

## Findings

### P0 — RLS: no tenant boundary (cross-class by design today, cross-tenant risk at scale)

- No `university_id`/`tenant_id` column anywhere in `public` (catalog query returned empty). `classes` has no owner university. At 1 class this is fine; at N universities, any missing `is_class_member` check leaks across universities. See `MULTI_TENANT_AUDIT.md`.

### P1 — `class_members` seq-scan storm (measured)

- `class_members`: `seq_scan 23903, seq_tup_read 357726` on `n_live_tup 30`, `idx_scan 37331`. `profiles`: `seq_scan 7484, seq_tup_read 108814` on 32 rows. Tiny tables, huge scan counts = called per-request/per-RLS-policy. `is_class_member()` invoked in RLS (migrations `20261029001200_class_rls.sql` pattern). Not a correctness bug; it is the hot path. Caching (already `-22f4` context: `listMyClasses` cached per request) mitigates but function itself re-evaluates per policy.

### P1 — Naming overlap: `classes` vs `courses` vs `class_subjects`

- User-flagged "berantakan". `classes` = enrollment cohort (e.g. `05TPLM002`), `courses` = catalogue (e.g. KC...), `class_subjects` = cohort's KC117 subject. Three levels, similar names, no `university_id` on any. Confusing for onboarding, error-prone for FK reasoning. Recommend rename PLAN (not action): `enrollment_cohorts` / `subjects` distinction in docs before any DDL.

### P2 — Zero-row tables growing unnoticed

- 17 tables at 0 rows (`notification_deliveries`, `push_subscriptions`, `google_calendar_*`, `class_applications`, …). Pipelines built but never exercised; retention/queue code unproven under load. P2: add synthetic load test before enabling push/calendar for real class.

### P2 — `attendance_verification_attempts` (55 rows, `seq_tup_read 12430`) with only `(session_idx, pkey)` — no user composite. Fine now; will need `(session_id, user_id)` at scale. Theoretical, not measured.

## Normalization

- Generally normalized (junction tables `class_members`, `class_admins`, `saved_assignments`, `leave_request_forwarding_items`).
- JSON/JSONB used appropriately: `assignments.tags TEXT[]`, `reference_urls jsonb`, `leave.field_sources jsonb` — last one bloats list queries (see QUERY_PERFORMANCE_AUDIT.md: `LIST_COLUMNS_SLIM` fix removed it).

## Referential risks

- `ON DELETE CASCADE` from `auth.users` → `profiles`, `assignments`, check-ins. Deleting an auth user wipes academic history. P1: replace with soft-suspend for class_members (deferred to proposal, needs product decision).
- `courses` FK `ON DELETE RESTRICT` — good, protects catalogue.
