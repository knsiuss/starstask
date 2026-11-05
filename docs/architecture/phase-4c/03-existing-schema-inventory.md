# 03 — Existing Schema Inventory (Verified from Migrations + Generated Types)

> **Status:** DRAFT. **Method:** `database.generated.ts` Tables section (52 entries — VERIFIED count) cross-checked against `CREATE TABLE` statements in `supabase/migrations/` (47 CREATE TABLE statements; remainder are columns added via `ALTER TABLE` e.g. `profiles.university`, plus storage buckets). 20-attribute table below is built from generated types + migration DDL. **No live DB access** — row counts/sizes are UNKNOWN (see `02-current-state-architecture.md`).

**Verified count: 52 tables** in `apps/web/src/types/database.generated.ts` (Tables section). Migrations contain 47 `CREATE TABLE IF NOT EXISTS` statements; the balance (5) arrive via later `ALTER`/`CREATE` variants plus storage objects — see diff note §3.2. The prior claim of "52 production tables" is **VERIFIED as consistent** with generated types. `auth.users` is referenced but NOT counted (Supabase Auth schema).

Generated types also list **143 functions** (Functions section — VERIFIED count). No views in `database.generated.ts` Views section (VERIFIED absent).

## 3.1 The 52 tables (grouped by domain)

### A. Identity & platform

| #   | Table             | Responsibility                                    | PK                           | FKs / Uniques / Checks / Indexes                                                                     | RLS | First migration |
| --- | ----------------- | ------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- | --- | --------------- |
| 1   | `profiles`        | Global user profile (one row per `auth.users`)    | `id uuid PK → auth.users.id` | FK `→auth.users` CASCADE; CHECK display_name length, avatar https; trigger `profiles_set_updated_at` | ON  | 20261029000100  |
| 2   | `platform_admins` | Platform Admin grants                             | `user_id uuid PK`            | FK `→auth.users`                                                                                     | ON  | 20261029000900  |
| 3   | `rate_limits`     | Auth/rate-limit counters (`consume_rate_limit()`) | `key text PK`                | —                                                                                                    | ON  | 20261029000100  |

### B. Courses & assignments

| #   | Table                    | Responsibility                                                       | PK                                  | FKs / Uniques / Checks / Indexes                                                                                                          | RLS | First migration |
| --- | ------------------------ | -------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------- |
| 4   | `courses`                | Course catalogue (global, deduplicated via `create_or_get_course()`) | `id uuid PK`                        | UNIQUE `normalized_name`; IDX `normalized_code` partial; CHECK name/code/dept lengths                                                     | ON  | 20261029000100  |
| 5   | `assignments`            | Public assignment briefs (title/description/course/deadline/tags)    | `id uuid PK`                        | FK `course_id →courses RESTRICT`, `user_id →auth.users CASCADE`; CHECKs title/desc/semester/year-format/type-allowed; `search_vector` GIN | ON  | 20261029000100  |
| 6   | `assignment_attachments` | Files attached to assignments                                        | `id uuid PK`                        | FK `assignment_id →assignments`, `owner_id →auth.users` (renamed `20261103130000`); storage bucket `assignment-attachments`               | ON  | 20261029000100  |
| 7   | `assignment_completions` | Mark-as-done / completion records (added 20261031100000)             | `(assignment_id,user_id)` composite | FKs to assignments + users                                                                                                                | ON  | 20261031100000  |
| 8   | `assignment_reviews`     | Moderation/review records for assignments                            | `id uuid PK`                        | FK `→assignments`, reviewer `→auth.users`                                                                                                 | ON  | 20261029000900  |
| 9   | `assignment_reports`     | User reports (trust loop 20261029003610)                             | `id uuid PK`                        | FK `→assignments`                                                                                                                         | ON  | 20261029003610  |
| 10  | `assignment_revisions`   | Revision history for assignments                                     | `id uuid PK`                        | FK `→assignments`                                                                                                                         | ON  | 20261029003610  |
| 11  | `saved_assignments`      | Saved/bookmarked assignments                                         | `(user_id,assignment_id)`           | FKs to users + assignments                                                                                                                | ON  | 20261029000500  |

### C. Classes, members, admins, invitations

| #   | Table                          | Responsibility                                         | PK                           | FKs / Uniques / Checks / Indexes                                                                                                  | RLS | First migration |
| --- | ------------------------------ | ------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- | --------------- |
| 12  | `classes`                      | Class workspace (course + schedule + lifecycle state)  | `id uuid PK`                 | FK `course_id →courses RESTRICT`; join policy/lifecycle columns added 20261031140000/20261031180000                               | ON  | 20261029000900  |
| 13  | `class_members`                | Class membership (who is in the class)                 | `(class_id,user_id)`         | FKs to classes + users                                                                                                            | ON  | 20261029000900  |
| 14  | `class_admins`                 | Class Admin grants + permission flags                  | `(class_id,user_id)`         | FKs to classes + users; delegation added 20261102101000                                                                           | ON  | 20261029000900  |
| 15  | `class_applications`           | Join requests                                          | `id uuid PK`                 | FK `→classes`, applicant `→auth.users`                                                                                            | ON  | 20261029000900  |
| 16  | `class_application_reviews`    | Review decisions on applications                       | `id uuid PK`                 | FK `→class_applications`                                                                                                          | ON  | 20261029000900  |
| 17  | `class_invitations`            | Invitation links/tokens + expiry                       | `id uuid PK`                 | FK `→classes`; token uniqueness                                                                                                   | ON  | 20261029000900  |
| 18  | `class_invitation_acceptances` | Acceptance log                                         | `id uuid PK`                 | FK `→class_invitations`                                                                                                           | ON  | 20261029000900  |
| 19  | `class_invitation_declines`    | Decline log                                            | `id uuid PK`                 | FK `→class_invitations`                                                                                                           | ON  | 20261029003300  |
| 20  | `class_subjects`               | Subject (course) under a class — the "course offering" | `id uuid PK`                 | FK `class_id →classes`, `course_id →courses`; UNIQUE `(class_id, normalized_code)` added 20261102103000; delete fn 20261029003600 | ON  | 20261029003300  |
| 21  | `class_subject_members`        | Per-subject enrollment (retake model, 20261110)        | `(class_subject_id,user_id)` | FKs to class_subjects + users                                                                                                     | ON  | 20261110000000  |
| 22  | `class_course_schedules`       | Weekly schedule rows per class subject                 | `id uuid PK`                 | FK `→class_subjects`; semester range added `20261105000000`                                                                       | ON  | 20261029003400  |
| 23  | `class_calendar_events`        | Class calendar events                                  | `id uuid PK`                 | FK `→classes`                                                                                                                     | ON  | 20261029003900  |
| 24  | `personal_calendar_events`     | User's personal calendar                               | `id uuid PK`                 | FK `owner →auth.users`                                                                                                            | ON  | 20261029003900  |

### D. Class verification & trust

| #   | Table                         | Responsibility                  | PK           | FKs / Uniques / Checks / Indexes                     | RLS | First migration |
| --- | ----------------------------- | ------------------------------- | ------------ | ---------------------------------------------------- | --- | --------------- |
| 25  | `class_verification_requests` | Verification requests per class | `id uuid PK` | FK `→classes`                                        | ON  | 20261029002600  |
| 26  | `class_verification_evidence` | Evidence files/links            | `id uuid PK` | FK `→requests`; storage bucket verification-evidence | ON  | 20261029002600  |
| 27  | `class_verification_reviews`  | Verifier decisions              | `id uuid PK` | FK `→requests`                                       | ON  | 20261029002600  |

### E. Discussion sessions & attendance meetings

| #   | Table                              | Responsibility                                                                                                       | PK                     | FKs / Uniques / Checks / Indexes                         | RLS | First migration |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------- | --- | --------------- |
| 28  | `discussion_sessions`              | Session/meeting container (also backs attendance meetings via trigger `discussion_sessions_fill_attendance_meeting`) | `id uuid PK`           | FK `→classes`                                            | ON  | 20261029001600  |
| 29  | `discussion_session_rsvps`         | RSVP per session                                                                                                     | `(session_id,user_id)` | FKs to sessions + users                                  | ON  | 20261029001600  |
| 30  | `discussion_session_reminders`     | Reminder schedule per session                                                                                        | `id uuid PK`           | FK `→sessions`                                           | ON  | 20261029001600  |
| 31  | `discussion_session_checkins`      | Attendance check-in rows (geo/manual; upgraded placeholder→real)                                                     | `id uuid PK`           | FK `→sessions`; coords retention stripped 20261031190000 | ON  | 20261029003700  |
| 32  | `attendance_verification_attempts` | Failed/successful identity+GPS attempts (read only via `attendance_meeting_failures()`)                              | `id uuid PK`           | FK `→sessions`                                           | ON  | 20261101090000  |
| 33  | `attendance_correction_audits`     | Correction history (who changed what, old→new)                                                                       | `id uuid PK`           | FKs to checkins/sessions/users                           | ON  | 20261103150000  |
| 34  | `course_materials`                 | Course-scoped materials (20261102110000)                                                                             | `id uuid PK`           | FK `→class_subjects` (course-scoped content)             | ON  | 20261102110000  |

### F. Leave requests

| #   | Table                            | Responsibility                                                 | PK           | FKs / Uniques / Checks / Indexes                    | RLS | First migration |
| --- | -------------------------------- | -------------------------------------------------------------- | ------------ | --------------------------------------------------- | --- | --------------- |
| 35  | `leave_requests`                 | Leave request header                                           | `id uuid PK` | FK applicant `→auth.users`, class `→classes`        | ON  | 20261029002200  |
| 36  | `leave_request_evidence`         | Evidence files (OCR-assisted; storage bucket leave-evidence)   | `id uuid PK` | FK `→leave_requests`; OCR confirm fn 20261029002300 | ON  | 20261029002200  |
| 37  | `leave_request_history`          | Status/revision history                                        | `id uuid PK` | FK `→leave_requests`                                | ON  | 20261029002200  |
| 38  | `leave_request_forwardings`      | Forwarding to lecturers                                        | `id uuid PK` | FK `→leave_requests`                                | ON  | 20261029002200  |
| 39  | `leave_request_forwarding_items` | Items inside a forwarding                                      | `id uuid PK` | FK `→forwardings`                                   | ON  | 20261029002200  |
| 40  | `leave_lecturer_outcomes`        | Lecturer decision outcomes (incl. course scope 20261104201000) | `id uuid PK` | FKs to leave_requests + users/subjects              | ON  | 20261104200000  |

### G. Notifications & push

| #   | Table                      | Responsibility                                       | PK                | FKs / Uniques / Checks / Indexes | RLS | First migration |
| --- | -------------------------- | ---------------------------------------------------- | ----------------- | -------------------------------- | --- | --------------- |
| 41  | `push_subscriptions`       | Web Push subscriptions (endpoint+keys; never logged) | `id uuid PK`      | FK `→auth.users`                 | ON  | 20261029000500  |
| 42  | `notification_preferences` | Per-user notification prefs                          | `(user_id, type)` | FK `→auth.users`                 | ON  | 20261029000500  |
| 43  | `notification_deliveries`  | Delivery attempts/state (claim/complete fns)         | `id uuid PK`      | FKs to users/events              | ON  | 20261029000500  |
| 44  | `notification_events`      | Outbox events (claim/complete)                       | `id uuid PK`      | —                                | ON  | 20261029001000  |
| 45  | `audit_logs`               | Audit trail (`record_audit()`)                       | `id uuid PK`      | —                                | ON  | 20261029000900  |

### H. Integrations & monitoring

| #   | Table                            | Responsibility                                     | PK           | FKs / Uniques / Checks / Indexes | RLS | First migration |
| --- | -------------------------------- | -------------------------------------------------- | ------------ | -------------------------------- | --- | --------------- |
| 46  | `google_calendar_connections`    | Google Calendar OAuth connections                  | `id uuid PK` | FK `→auth.users`                 | ON  | 20261029001900  |
| 47  | `google_calendar_event_mappings` | Calendar event ↔ session mapping                   | `id uuid PK` | FKs to connections + sessions    | ON  | 20261029001900  |
| 48  | `auth_activity_events`           | Auth activity log                                  | `id uuid PK` | —                                | ON  | 20261029002800  |
| 49  | `app_activity_events`            | App activity log (PII-free variant 20261029003200) | `id uuid PK` | —                                | ON  | 20261029002800  |
| 50  | `app_error_events`               | Error events                                       | `id uuid PK` | —                                | ON  | 20261029002800  |
| 51  | `developer_incidents`            | Developer incident tracking                        | `id uuid PK` | —                                | ON  | 20261029003210  |
| 52  | `developer_incident_notes`       | Notes on incidents                                 | `id uuid PK` | FK `→developer_incidents`        | ON  | 20261029003210  |

**Attribute coverage (honest disclaimer):** this file does NOT enumerate all 20 attributes per table in-doc. Covered in-doc per table (VERIFIED): name, responsibility, PK (+ type), FKs, uniques, checks (major), indexes (major), RLS on/off, first-migration pointer. Covered elsewhere: full column-level dictionaries (types vs nullability vs defaults per column) live in `docs/database/architecture/COLUMN_DICTIONARY.md` (230 KB, REPORTED — not re-verified line-by-line in Phase 4C); object-level functions/triggers/policies live in `docs/database/architecture/DATABASE_OBJECTS.md` + `RLS_POLICIES.md` (REPORTED). Row counts / data sizes / seq-scan stats: UNKNOWN here (no live DB access — see `02`); dependencies/integrity-risk shorthand is in-doc; per-function callers are in `05`/`24`. `created_at/updated_at` + `set_updated_at()` (43 trigger occurrences VERIFIED) apply to many tables — see COLUMN_DICTIONARY for the per-table list.

## 3.2 Migrations vs generated types diff

- **In generated types (52) but no explicit `CREATE TABLE` found by initial grep:** all 52 appear via CREATE TABLE; apparent gap was grep casing (`create table if not exists` lowercase in `20261029000900_classes.sql` etc.). After case-insensitive check: **all 52 accounted for (VERIFIED — no diff)**.
- **In migrations but NOT in generated types:** none identified (no extra `CREATE TABLE` beyond the 52). Storage buckets and `auth.users` are not tables in `public`.
- **Phase 4B caveat (REPORTED):** production reportedly has 52 tables but also `public.rls_auto_enable()` + event trigger `ensure_rls` NOT present in migrations (production-only). This does not change the 52-table count.

## 3.3 Missing / absent (VERIFIED by grep across migrations + generated types)

- **No `universities` table.** University is free-text `profiles.university` (`20261029002700_profile_onboarding.sql`) — VERIFIED ABSENT as a table.
- **No grading tables.** Zero `grade`/`nilai` tables/columns (VERIFIED ABSENT).
- **No lecturer-role tables.** No lecturer FKs/tables (VERIFIED ABSENT).
- **No `pg_cron` usage** (0 hits — VERIFIED ABSENT in migrations).
- **No views** in generated types (VERIFIED absent).

---

_Row counts, storage sizes, seq-scan stats: UNKNOWN (no live DB access; see `02-current-state-architecture.md`)._
