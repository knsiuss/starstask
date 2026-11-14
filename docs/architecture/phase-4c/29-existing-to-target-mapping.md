# 29 — Existing-to-Target Mapping (Every Verified Table)

> **Status:** DRAFT. All 52 tables from `03` are covered. Decisions: KEEP / MODIFY / MERGE / SPLIT / DEPRECATE / NEW.

| #   | Existing table                     | Decision | Target                                                | Migration note                                                         |
| --- | ---------------------------------- | -------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `profiles`                         | MODIFY   | `profiles`                                            | drop `university`/`nim` cols (move to `student_identities`); keep rest |
| 2   | `platform_admins`                  | KEEP     | `platform_admins`                                     | no change                                                              |
| 3   | `rate_limits`                      | KEEP     | `rate_limits`                                         | no change                                                              |
| 4   | `courses`                          | KEEP     | `courses`                                             | catalogue scope UNRESOLVED (global vs tenant)                          |
| 5   | `assignments`                      | MODIFY   | `assignments`                                         | + `university_id`, `offering_id` nullable; backfill                    |
| 6   | `assignment_attachments`           | MODIFY   | `assignment_attachments`                              | + `university_id` backfill                                             |
| 7   | `assignment_completions`           | KEEP     | `assignment_completions`                              | —                                                                      |
| 8   | `assignment_reviews`               | KEEP     | `assignment_reviews`                                  | —                                                                      |
| 9   | `assignment_reports`               | KEEP     | `assignment_reports`                                  | —                                                                      |
| 10  | `assignment_revisions`             | KEEP     | `assignment_revisions`                                | —                                                                      |
| 11  | `saved_assignments`                | KEEP     | `saved_assignments`                                   | —                                                                      |
| 12  | `classes`                          | MODIFY   | `classes`                                             | + `university_id`, `unit_id`, `home_code`, `entry_year`, `status`      |
| 13  | `class_members`                    | MERGE    | `class_memberships`                                   | re-key `user_id`→`student_identity_id` (via temp map)                  |
| 14  | `class_admins`                     | SPLIT    | `class_admin_assignments` + `class_admin_permissions` | normalize flag columns into permission rows                            |
| 15  | `class_applications`               | KEEP     | `class_applications`                                  | + `university_id` backfill                                             |
| 16  | `class_application_reviews`        | KEEP     | `class_application_reviews`                           | —                                                                      |
| 17  | `class_invitations`                | KEEP     | `class_invitations`                                   | class-level kept; course tokens are separate NEW                       |
| 18  | `class_invitation_acceptances`     | KEEP     | unchanged                                             | —                                                                      |
| 19  | `class_invitation_declines`        | KEEP     | unchanged                                             | —                                                                      |
| 20  | `class_subjects`                   | MERGE    | `course_offerings`                                    | + `university_id`, `academic_period_id`, `status`, composite unique    |
| 21  | `class_subject_members`            | RENAME   | `enrollments`                                         | + `university_id`, `source`, `status`, composite FK                    |
| 22  | `class_course_schedules`           | SPLIT    | `schedule_rules` (+ instances/exceptions)             | rows→rules; instances materialized                                     |
| 23  | `class_calendar_events`            | KEEP     | `class_calendar_events`                               | + `university_id`                                                      |
| 24  | `personal_calendar_events`         | KEEP     | `personal_calendar_events`                            | —                                                                      |
| 25  | `class_verification_requests`      | KEEP     | unchanged                                             | + `university_id`                                                      |
| 26  | `class_verification_evidence`      | KEEP     | unchanged                                             | + `university_id`                                                      |
| 27  | `class_verification_reviews`       | KEEP     | unchanged                                             | —                                                                      |
| 28  | `discussion_sessions`              | KEEP     | `discussion_sessions`                                 | attendance split-out in parallel (meetings NEW)                        |
| 29  | `discussion_session_rsvps`         | KEEP     | unchanged                                             | —                                                                      |
| 30  | `discussion_session_reminders`     | KEEP     | unchanged                                             | —                                                                      |
| 31  | `discussion_session_checkins`      | RENAME   | `attendance_records`                                  | + `meeting_id`→`attendance_meetings`, `student_identity_id`            |
| 32  | `attendance_verification_attempts` | KEEP     | unchanged                                             | re-point to meetings if split confirms                                 |
| 33  | `attendance_correction_audits`     | RENAME   | `attendance_corrections`                              | + `reason` NOT NULL                                                    |
| 34  | `course_materials`                 | MODIFY   | `course_materials`                                    | `class_subject_id`→`offering_id`, + `university_id`, path prefix       |
| 35  | `leave_requests`                   | MODIFY   | `leave_requests`                                      | + `university_id`, `student_identity_id` alongside applicant           |
| 36  | `leave_request_evidence`           | KEEP     | unchanged                                             | + `university_id` via parent                                           |
| 37  | `leave_request_history`            | KEEP     | unchanged                                             | —                                                                      |
| 38  | `leave_request_forwardings`        | KEEP     | unchanged                                             | —                                                                      |
| 39  | `leave_request_forwarding_items`   | KEEP     | unchanged                                             | —                                                                      |
| 40  | `leave_lecturer_outcomes`          | KEEP     | unchanged                                             | lecturer semantics UNRESOLVED                                          |
| 41  | `push_subscriptions`               | KEEP     | unchanged                                             | —                                                                      |
| 42  | `notification_preferences`         | KEEP     | unchanged                                             | —                                                                      |
| 43  | `notification_deliveries`          | MODIFY   | `notification_deliveries`                             | + `university_id` derived                                              |
| 44  | `notification_events`              | MODIFY   | `notification_events`                                 | + `university_id` derived                                              |
| 45  | `audit_logs`                       | MODIFY   | `audit_logs`                                          | + `university_id`, `before/after` jsonb                                |
| 46  | `google_calendar_connections`      | KEEP     | unchanged                                             | —                                                                      |
| 47  | `google_calendar_event_mappings`   | KEEP     | unchanged                                             | —                                                                      |
| 48  | `auth_activity_events`             | KEEP     | unchanged                                             | —                                                                      |
| 49  | `app_activity_events`              | KEEP     | unchanged                                             | —                                                                      |
| 50  | `app_error_events`                 | KEEP     | unchanged                                             | —                                                                      |
| 51  | `developer_incidents`              | KEEP     | unchanged                                             | —                                                                      |
| 52  | `developer_incident_notes`         | KEEP     | unchanged                                             | —                                                                      |

**NEW (no existing equivalent):** `universities`, `academic_units`, `academic_periods`, `student_identities`, `course_invite_tokens` (+ acceptances), `class_admin_assignments/permissions` (SPLIT from `class_admins`), `attendance_meetings`, `grade_batches/entries/history`, `schedule_rules/instances/exceptions`, `announcements`.

**DEPRECATE:** `profiles.university`, `profiles.nim` (columns, after `student_identities` backfill); `courses.department` (after `academic_units` linkage).

## Column mapping highlights

- `class_members.user_id` → `class_memberships.student_identity_id` via `profiles ↔ student_identities` bridge (unresolved mapping for rows without a verified identity — default to auto-created pending identity, audited).
- `class_admins` flag columns → `class_admin_permissions` rows (one row per true flag; `manage_admins` holder count preserved for last-admin trigger).
- `class_subjects` → `course_offerings` (direct PK carryover; new `academic_period_id` backfilled from `class_course_schedules.semester_range` where possible, else owner-confirmed default).
- `discussion_session_checkins.session_id` → `attendance_records.meeting_id` (each session spawning one meeting; multi-meeting sessions need product decision — UNRESOLVED).

---

_No migration executed. All SQL in this file is conceptual._
