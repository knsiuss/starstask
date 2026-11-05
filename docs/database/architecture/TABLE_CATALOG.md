# Table Catalog â€” StarsTask (public schema)

> **Generated:** 2026-11-04 from PostgreSQL catalog dumps (local Supabase stack, PostgreSQL 17.11) + remote production cross-checks (project `kdqsrckmmoucdqiapovr`, `starstask`, ap-northeast-2).
> **Method:** read-only `COPY (... pg_catalog ...) TO STDOUT` queries; local `SELECT count(*)` per table; MCP `execute_sql` for remote counts/estimates. No DDL was executed.
> **Evidence legend:** VERIFIED = directly observed in catalog metadata; INFERRED = interpretation from names/types/app usage; UNKNOWN = insufficient evidence.
> Parent document: [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md)

All 52 public tables (VERIFIED from `pg_class`/`pg_namespace`, local DB 2026-11-04).
Row counts: _local actual_ = `SELECT count(*)` on the fresh local stack (VERIFIED);
_remote estimate_ = `pg_class.reltuples` on production (ESTIMATE, not exact).
Sizes are local `pg_total_relation_size` (VERIFIED, local only).

| Table                            | Local rows (actual) | Remote rows (estimate) | Local size (KiB) | RLS | RLS forced | Policies | Indexes | Triggers | PK  | Unique | Check | FK  | Comment                                                                                                                                                                                                |
| -------------------------------- | ------------------- | ---------------------- | ---------------- | --- | ---------- | -------- | ------- | -------- | --- | ------ | ----- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| app_activity_events              | ?                   | 0                      | 40               | YES | NO         | 0        | 4       | 0        | 1   | 0      | 4     | 2   | Sanitized application activity. Never contains email, NIM, names, document contents, tokens, or credentials.                                                                                           |
| app_error_events                 | ?                   | 172                    | 24               | YES | NO         | 0        | 2       | 0        | 1   | 0      | 4     | 0   | Sanitized server error telemetry: route, method, error name, digest. Never contains messages, stacks, headers, bodies, or personal data.                                                               |
| assignment_attachments           | ?                   | 0                      | 64               | YES | NO         | 5        | 3       | 0        | 1   | 1      | 3     | 1   |                                                                                                                                                                                                        |
| assignment_completions           | ?                   | 0                      | 16               | YES | NO         | 3        | 2       | 0        | 1   | 0      | 0     | 2   |                                                                                                                                                                                                        |
| assignment_reports               | ?                   | 0                      | 40               | YES | NO         | 1        | 4       | 0        | 1   | 0      | 4     | 4   | Reader-submitted problems with an assignment. One open report per reader per assignment; written only through report_assignment() and reviewed through review_assignment_report().                     |
| assignment_reviews               | ?                   | 0                      | 24               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 3     | 2   |                                                                                                                                                                                                        |
| assignment_revisions             | ?                   | 0                      | 80               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 1     | 3   | Append-only snapshots of reader-visible assignment fields, written by the assignments trigger. Never updated or deleted from a client.                                                                 |
| assignments                      | ?                   | 2                      | 224              | YES | NO         | 8        | 10      | 8        | 1   | 0      | 14    | 5   |                                                                                                                                                                                                        |
| attendance_correction_audits     | ?                   | 87                     | 40               | YES | NO         | 1        | 4       | 0        | 1   | 0      | 5     | 5   | Append-only record of every manual attendance correction. Written only by record_attendance_correction(); students cannot see or change it.                                                            |
| attendance_verification_attempts | ?                   | 51                     | 24               | YES | NO         | 0        | 2       | 0        | 1   | 0      | 3     | 2   | Failed and successful identity/GPS attempts for attendance meetings. Read only through attendance_meeting_failures(). No typed name or NIM is stored.                                                  |
| audit_logs                       | ?                   | 273                    | 40               | YES | NO         | 1        | 4       | 0        | 1   | 0      | 3     | 2   | Append-only audit trail. Metadata never contains tokens, emails, or credentials.                                                                                                                       |
| auth_activity_events             | ?                   | 0                      | 40               | YES | NO         | 0        | 4       | 0        | 1   | 0      | 4     | 1   | Sanitized sign-in telemetry. Never contains email, NIM, names, document contents, tokens, or credentials.                                                                                              |
| class_admins                     | ?                   | 0                      | 40               | YES | NO         | 1        | 2       | 1        | 1   | 0      | 0     | 2   | Class administrator assignments. Always a subset of class_members.                                                                                                                                     |
| class_application_reviews        | ?                   | 0                      | 24               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 2     | 2   |                                                                                                                                                                                                        |
| class_applications               | ?                   | 0                      | 40               | YES | NO         | 1        | 4       | 1        | 1   | 0      | 14    | 3   | User requests to create a class. Status changes happen only inside SECURITY DEFINER functions.                                                                                                         |
| class_calendar_events            | ?                   | 0                      | 40               | YES | NO         | 4        | 4       | 3        | 1   | 0      | 8     | 3   | Official group events created by class admins: exams, academic events, and one-off class meetings.                                                                                                     |
| class_course_schedules           | ?                   | 0                      | 32               | YES | NO         | 4        | 3       | 3        | 1   | 0      | 6     | 3   | Recurring weekly meeting slots for the subjects of a class. day_of_week: 1=Monday .. 7=Sunday; times are class-local wall clock.                                                                       |
| class_invitation_acceptances     | ?                   | 0                      | 16               | YES | NO         | 1        | 2       | 0        | 1   | 1      | 0     | 2   |                                                                                                                                                                                                        |
| class_invitation_declines        | ?                   | 0                      | 24               | YES | NO         | 2        | 3       | 0        | 1   | 1      | 0     | 2   | Records when a user declines a pending invitation so it is removed from their dashboard.                                                                                                               |
| class_invitations                | ?                   | 0                      | 32               | YES | NO         | 1        | 3       | 0        | 1   | 1      | 5     | 3   | Invitation links. token_hash only; expires_at, revocation, and max_uses are checked server-side on acceptance.                                                                                         |
| class_members                    | ?                   | 23                     | 48               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 1     | 2   | Class membership. Invitation links grant this row and nothing else.                                                                                                                                    |
| class_subjects                   | ?                   | 10                     | 40               | YES | NO         | 4        | 4       | 1        | 1   | 0      | 5     | 3   | Subjects/courses created within a main class group. Inherits membership from the parent class.                                                                                                         |
| class_verification_evidence      | ?                   | 0                      | 32               | YES | NO         | 1        | 3       | 0        | 1   | 1      | 5     | 3   |                                                                                                                                                                                                        |
| class_verification_requests      | ?                   | 0                      | 48               | YES | NO         | 1        | 5       | 1        | 1   | 0      | 8     | 3   | Class representative verification requests. A verified row grants class admin access to exactly one class, and only through decide_class_verification.                                                 |
| class_verification_reviews       | ?                   | 0                      | 24               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 4     | 2   |                                                                                                                                                                                                        |
| classes                          | ?                   | 4                      | 120              | YES | NO         | 1        | 7       | 2        | 1   | 0      | 13    | 3   | Approved academic classes. Created only by the platform approval workflow, never by direct client insert.                                                                                              |
| course_materials                 | ?                   | 0                      | 24               | YES | NO         | 4        | 2       | 3        | 1   | 0      | 5     | 3   | Learning materials attached to one course inside a class group.                                                                                                                                        |
| courses                          | ?                   | 0                      | 64               | YES | NO         | 1        | 3       | 0        | 1   | 0      | 3     | 0   | Course catalogue. Read-only for clients; created through public.create_or_get_course().                                                                                                                |
| developer_incident_notes         | ?                   | 0                      | 24               | YES | NO         | 0        | 2       | 0        | 1   | 0      | 1     | 2   | Investigation notes for developer incidents. Service-role only; actors are server-verified session user IDs.                                                                                           |
| developer_incidents              | ?                   | 0                      | 32               | YES | NO         | 0        | 3       | 0        | 1   | 0      | 4     | 2   | Operational incidents tracked by allowlisted developers. Service-role only; actors are server-verified session user IDs.                                                                               |
| discussion_session_checkins      | ?                   | 121                    | 48               | YES | NO         | 1        | 5       | 0        | 1   | 1      | 6     | 3   | Attendance for one session. Geo rows come from check_in_discussion_session(); manual rows from record_discussion_session_checkin(). Coordinates support dispute review and are not granted to clients. |
| discussion_session_reminders     | ?                   | 0                      | 40               | YES | NO         | 0        | 4       | 1        | 1   | 1      | 4     | 2   | Durable session reminder ledger. No payload or subscription key is stored here.                                                                                                                        |
| discussion_session_rsvps         | ?                   | 0                      | 40               | YES | NO         | 1        | 4       | 1        | 1   | 1      | 1     | 2   | Participant registrations. Written only through rsvp_discussion_session / cancel_session_rsvp.                                                                                                         |
| discussion_sessions              | ?                   | 0                      | 72               | YES | NO         | 1        | 8       | 4        | 1   | 0      | 22    | 4   | Scheduled class discussions. Created and changed only through the SECURITY DEFINER functions in 20261029001700_session_functions.sql.                                                                  |
| feedback_entries                 | ?                   | 0                      | 32               | YES | NO         | 4        | 3       | 1        | 1   | 0      | 4     | 1   | In-app feedback from signed-in users. No email, name, or attached files are stored.                                                                                                                    |
| google_calendar_connections      | ?                   | 0                      | 16               | YES | NO         | 1        | 1       | 1        | 1   | 0      | 6     | 1   | Encrypted Google Calendar OAuth credentials. Token columns are never granted to clients.                                                                                                               |
| google_calendar_event_mappings   | ?                   | 0                      | 48               | YES | NO         | 1        | 5       | 1        | 1   | 1      | 6     | 2   | Idempotency ledger for Google Calendar events. Written only by the server-side sync service.                                                                                                           |
| leave_lecturer_outcomes          | ?                   | 0                      | 24               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 2     | 2   |                                                                                                                                                                                                        |
| leave_request_evidence           | ?                   | 0                      | 32               | YES | NO         | 1        | 3       | 0        | 1   | 1      | 6     | 3   |                                                                                                                                                                                                        |
| leave_request_forwarding_items   | ?                   | 0                      | 32               | YES | NO         | 1        | 3       | 0        | 1   | 1      | 2     | 2   |                                                                                                                                                                                                        |
| leave_request_forwardings        | ?                   | 0                      | 40               | YES | NO         | 1        | 4       | 0        | 1   | 2      | 7     | 2   |                                                                                                                                                                                                        |
| leave_request_history            | ?                   | 0                      | 24               | YES | NO         | 1        | 2       | 0        | 1   | 0      | 3     | 2   |                                                                                                                                                                                                        |
| leave_requests                   | ?                   | 0                      | 64               | YES | NO         | 1        | 7       | 2        | 1   | 1      | 16    | 3   |                                                                                                                                                                                                        |
| notification_deliveries          | ?                   | 0                      | 48               | YES | NO         | 1        | 5       | 1        | 1   | 1      | 4     | 2   | Durable reminder ledger. No notification payload or subscription key is stored here.                                                                                                                   |
| notification_events              | ?                   | 0                      | 48               | YES | NO         | 1        | 5       | 1        | 1   | 1      | 7     | 1   | Point-in-time push events. No tokens, emails, or moderation notes are stored in payload.                                                                                                               |
| notification_preferences         | ?                   | 0                      | 16               | YES | NO         | 3        | 1       | 1        | 1   | 0      | 1     | 1   | Per-user reminder opt-in. push_enabled = false stops delivery immediately.                                                                                                                             |
| personal_calendar_events         | ?                   | 0                      | 32               | YES | NO         | 4        | 3       | 1        | 1   | 0      | 6     | 1   | Private events owned by one user. Visible only to that user through RLS.                                                                                                                               |
| platform_admins                  | ?                   | 0                      | 8                | YES | NO         | 0        | 1       | 0        | 1   | 0      | 0     | 2   | Trusted platform administrators. No client policies: granting is a manual, audited operation.                                                                                                          |
| profiles                         | ?                   | 26                     | 40               | YES | NO         | 2        | 2       | 1        | 1   | 0      | 8     | 1   | Public contributor identity. One row per auth.users row, provisioned by trigger.                                                                                                                       |
| push_subscriptions               | ?                   | 0                      | 32               | YES | NO         | 4        | 3       | 1        | 1   | 1      | 5     | 1   | Browser push endpoints. Endpoints and keys are sensitive and are never exposed through the API.                                                                                                        |
| rate_limits                      | ?                   | 91                     | 16               | YES | NO         | 0        | 1       | 0        | 1   | 0      | 2     | 0   | Fixed-window counters used by public.consume_rate_limit(). Never exposed to clients.                                                                                                                   |
| saved_assignments                | ?                   | 0                      | 32               | YES | NO         | 3        | 4       | 0        | 1   | 1      | 0     | 2   |                                                                                                                                                                                                        |

**VERIFIED totals:** 52 tables; RLS-enabled = 52;
RLS-forced = 0; policies = 83;
indexes = 175; foreign keys = 112.
Comments: only 37 of 52 tables carry a database comment (VERIFIED).

### `app_activity_events`

- **Primary key** `app_activity_events_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `app_activity_events_metadata_no_pii`: `CHECK ((NOT (metadata ?| ARRAY['email'::text, 'nim'::text, 'full_name'::text, 'name'::text, 'phone'::text, 'avatar_url'::text])))` validated=t
- **Check** `app_activity_events_metadata_object`: `CHECK ((jsonb_typeof(metadata) = 'object'::text))` validated=t
- **Check** `app_activity_events_resource_type_format`: `CHECK ((resource_type ~ '^[a-z][a-z0-9_]{2,63}$'::text))` validated=t
- **Check** `app_activity_events_type_allowed`: `CHECK ((event_type = ANY (ARRAY['assignment_created'::text, 'assignment_updated'::text, 'assignment_deleted'::text])))` validated=t
- **Foreign key** `app_activity_events_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `app_activity_events_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL` validated=t
- **Index** `app_activity_events_actor_created_idx` (btree, unique=f): `CREATE INDEX app_activity_events_actor_created_idx ON public.app_activity_events USING btree (actor_id, created_at DESC)`
- **Index** `app_activity_events_created_idx` (btree, unique=f): `CREATE INDEX app_activity_events_created_idx ON public.app_activity_events USING btree (created_at DESC)`
- **Index** `app_activity_events_pkey` (btree, unique=t): `CREATE UNIQUE INDEX app_activity_events_pkey ON public.app_activity_events USING btree (id)`
- **Index** `app_activity_events_type_created_idx` (btree, unique=f): `CREATE INDEX app_activity_events_type_created_idx ON public.app_activity_events USING btree (event_type, created_at DESC)`
- **RLS policies:** 0

### `app_error_events`

- **Primary key** `app_error_events_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `app_error_events_digest_length`: `CHECK (((error_digest IS NULL) OR (char_length(error_digest) <= 100)))` validated=t
- **Check** `app_error_events_method_length`: `CHECK (((method IS NULL) OR (char_length(method) <= 16)))` validated=t
- **Check** `app_error_events_name_length`: `CHECK (((error_name IS NULL) OR (char_length(error_name) <= 100)))` validated=t
- **Check** `app_error_events_route_length`: `CHECK (((route_path IS NULL) OR (char_length(route_path) <= 300)))` validated=t
- **Index** `app_error_events_created_idx` (btree, unique=f): `CREATE INDEX app_error_events_created_idx ON public.app_error_events USING btree (created_at DESC)`
- **Index** `app_error_events_pkey` (btree, unique=t): `CREATE UNIQUE INDEX app_error_events_pkey ON public.app_error_events USING btree (id)`
- **RLS policies:** 0

### `assignment_attachments`

- **Primary key** `assignment_attachments_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `assignment_attachments_path_key`: `UNIQUE (storage_path)` validated=t
- **Check** `assignment_attachments_filename_length`: `CHECK (((char_length(btrim(original_filename)) >= 1) AND (char_length(btrim(original_filename)) <= 255)))` validated=t
- **Check** `assignment_attachments_mime_allowed`: `CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'::text, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::text, 'image/png'::text, 'image/jpeg'::text])))` validated=t
- **Check** `assignment_attachments_size`: `CHECK (((file_size >= 1) AND (file_size <= 10485760)))` validated=t
- **Foreign key** `assignment_attachments_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Index** `assignment_attachments_assignment_idx` (btree, unique=f): `CREATE INDEX assignment_attachments_assignment_idx ON public.assignment_attachments USING btree (assignment_id)`
- **Index** `assignment_attachments_path_key` (btree, unique=t): `CREATE UNIQUE INDEX assignment_attachments_path_key ON public.assignment_attachments USING btree (storage_path)`
- **Index** `assignment_attachments_pkey` (btree, unique=t): `CREATE UNIQUE INDEX assignment_attachments_pkey ON public.assignment_attachments USING btree (id)`
- **RLS policies:** 5 â€” `assignment_attachments_owner_delete`, `assignment_attachments_owner_insert`, `assignment_attachments_owner_update`, `assignment_attachments_read`, `assignment_attachments_reviewer_read`

### `assignment_completions`

- **Primary key** `assignment_completions_pkey`: `PRIMARY KEY (assignment_id, user_id)` validated=t
- **Foreign key** `assignment_completions_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Foreign key** `assignment_completions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `assignment_completions_pkey` (btree, unique=t): `CREATE UNIQUE INDEX assignment_completions_pkey ON public.assignment_completions USING btree (assignment_id, user_id)`
- **Index** `assignment_completions_user_idx` (btree, unique=f): `CREATE INDEX assignment_completions_user_idx ON public.assignment_completions USING btree (user_id, completed_at DESC)`
- **RLS policies:** 3 â€” `assignment_completions_delete_own`, `assignment_completions_insert_own`, `assignment_completions_select_own`

### `assignment_reports`

- **Primary key** `assignment_reports_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `assignment_reports_note_length`: `CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 5) AND (char_length(btrim(note)) <= 2000))))` validated=t
- **Check** `assignment_reports_reason_allowed`: `CHECK ((reason = ANY (ARRAY['wrong_deadline'::text, 'wrong_details'::text, 'duplicate'::text, 'broken_attachment'::text, 'other'::text])))` validated=t
- **Check** `assignment_reports_resolution_note_length`: `CHECK (((resolution_note IS NULL) OR ((char_length(btrim(resolution_note)) >= 5) AND (char_length(btrim(resolution_note)) <= 2000))))` validated=t
- **Check** `assignment_reports_status_allowed`: `CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text])))` validated=t
- **Foreign key** `assignment_reports_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Foreign key** `assignment_reports_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `assignment_reports_reporter_id_fkey`: `FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Foreign key** `assignment_reports_resolved_by_fkey`: `FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `assignment_reports_class_idx` (btree, unique=f): `CREATE INDEX assignment_reports_class_idx ON public.assignment_reports USING btree (class_id, status, created_at DESC)`
- **Index** `assignment_reports_one_open_idx` (btree, unique=t): `CREATE UNIQUE INDEX assignment_reports_one_open_idx ON public.assignment_reports USING btree (assignment_id, reporter_id) WHERE (status = 'open'::text)`
- **Index** `assignment_reports_pkey` (btree, unique=t): `CREATE UNIQUE INDEX assignment_reports_pkey ON public.assignment_reports USING btree (id)`
- **Index** `assignment_reports_queue_idx` (btree, unique=f): `CREATE INDEX assignment_reports_queue_idx ON public.assignment_reports USING btree (status, created_at DESC)`
- **RLS policies:** 1 â€” `assignment_reports_select`

### `assignment_reviews`

- **Primary key** `assignment_reviews_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `assignment_reviews_decision_allowed`: `CHECK ((decision = ANY (ARRAY['submitted'::text, 'approved'::text, 'rejected'::text, 'unpublished'::text, 'restored'::text, 'archived'::text])))` validated=t
- **Check** `assignment_reviews_reason_length`: `CHECK (((reason IS NULL) OR (char_length(btrim(reason)) <= 2000)))` validated=t
- **Check** `assignment_reviews_reason_required`: `CHECK (((decision <> ALL (ARRAY['rejected'::text, 'unpublished'::text, 'archived'::text])) OR ((reason IS NOT NULL) AND (char_length(btrim(reason)) >= 3))))` validated=t
- **Foreign key** `assignment_reviews_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Foreign key** `assignment_reviews_reviewer_id_fkey`: `FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `assignment_reviews_assignment_idx` (btree, unique=f): `CREATE INDEX assignment_reviews_assignment_idx ON public.assignment_reviews USING btree (assignment_id, created_at DESC)`
- **Index** `assignment_reviews_pkey` (btree, unique=t): `CREATE UNIQUE INDEX assignment_reviews_pkey ON public.assignment_reviews USING btree (id)`
- **RLS policies:** 1 â€” `assignment_reviews_read`

### `assignment_revisions`

- **Primary key** `assignment_revisions_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `assignment_revisions_kind_allowed`: `CHECK ((change_kind = ANY (ARRAY['created'::text, 'updated'::text, 'moderated'::text])))` validated=t
- **Foreign key** `assignment_revisions_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Foreign key** `assignment_revisions_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL` validated=t
- **Foreign key** `assignment_revisions_editor_id_fkey`: `FOREIGN KEY (editor_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `assignment_revisions_assignment_idx` (btree, unique=f): `CREATE INDEX assignment_revisions_assignment_idx ON public.assignment_revisions USING btree (assignment_id, created_at DESC)`
- **Index** `assignment_revisions_pkey` (btree, unique=t): `CREATE UNIQUE INDEX assignment_revisions_pkey ON public.assignment_revisions USING btree (id)`
- **RLS policies:** 1 â€” `assignment_revisions_select`

### `assignments`

- **Primary key** `assignments_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `assignments_academic_year_format`: `CHECK (((academic_year IS NULL) OR (academic_year ~ '^\d{4}/\d{4}$'::text)))` validated=t
- **Check** `assignments_content_type_allowed`: `CHECK ((content_type = ANY (ARRAY['lecturer_assignment'::text, 'class_announcement'::text])))` validated=t
- **Check** `assignments_description_length`: `CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 20000)))` validated=t
- **Check** `assignments_drive_url_https`: `CHECK (((drive_url IS NULL) OR ((drive_url ~ '^https://[^[:space:]]+$'::text) AND ((char_length(drive_url) >= 16) AND (char_length(drive_url) <= 2048)))))` validated=t
- **Check** `assignments_lecturer_length`: `CHECK (((lecturer_name IS NULL) OR ((char_length(btrim(lecturer_name)) >= 1) AND (char_length(btrim(lecturer_name)) <= 120))))` validated=t
- **Check** `assignments_references_array`: `CHECK (((jsonb_typeof(reference_urls) = 'array'::text) AND (jsonb_array_length(reference_urls) <= 10)))` validated=t
- **Check** `assignments_rejection_reason_length`: `CHECK (((rejection_reason IS NULL) OR ((char_length(btrim(rejection_reason)) >= 3) AND (char_length(btrim(rejection_reason)) <= 2000))))` validated=t
- **Check** `assignments_revision_positive`: `CHECK (((revision >= 1) AND (revision <= 100)))` validated=t
- **Check** `assignments_semester_length`: `CHECK (((semester IS NULL) OR ((char_length(btrim(semester)) >= 1) AND (char_length(btrim(semester)) <= 20))))` validated=t
- **Check** `assignments_source_label_length`: `CHECK (((source_label IS NULL) OR ((char_length(btrim(source_label)) >= 1) AND (char_length(btrim(source_label)) <= 120))))` validated=t
- **Check** `assignments_status_allowed`: `CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'pending'::text, 'published'::text, 'rejected'::text, 'unpublished'::text, 'archived'::text])))` validated=t
- **Check** `assignments_tags_limit`: `CHECK ((COALESCE(array_length(tags, 1), 0) <= 10))` validated=t
- **Check** `assignments_title_length`: `CHECK (((char_length(btrim(title)) >= 3) AND (char_length(btrim(title)) <= 200)))` validated=t
- **Check** `assignments_type_allowed`: `CHECK (((assignment_type IS NULL) OR (assignment_type = ANY (ARRAY['individual'::text, 'group'::text, 'lab'::text, 'project'::text, 'presentation'::text, 'exam'::text, 'other'::text]))))` validated=t
- **Foreign key** `assignments_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL` validated=t
- **Foreign key** `assignments_course_id_fkey`: `FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT` validated=t
- **Foreign key** `assignments_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `assignments_subject_id_fkey`: `FOREIGN KEY (subject_id) REFERENCES class_subjects(id) ON DELETE SET NULL` validated=t
- **Foreign key** `assignments_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `assignments_class_idx` (btree, unique=f): `CREATE INDEX assignments_class_idx ON public.assignments USING btree (class_id, status)`
- **Index** `assignments_course_idx` (btree, unique=f): `CREATE INDEX assignments_course_idx ON public.assignments USING btree (course_id)`
- **Index** `assignments_deadline_idx` (btree, unique=f): `CREATE INDEX assignments_deadline_idx ON public.assignments USING btree (deadline) WHERE (status = 'published'::text)`
- **Index** `assignments_owner_recent_idx` (btree, unique=f): `CREATE INDEX assignments_owner_recent_idx ON public.assignments USING btree (user_id, created_at DESC)`
- **Index** `assignments_pkey` (btree, unique=t): `CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (id)`
- **Index** `assignments_public_recent_idx` (btree, unique=f): `CREATE INDEX assignments_public_recent_idx ON public.assignments USING btree (created_at DESC) WHERE (status = 'published'::text)`
- **Index** `assignments_review_queue_idx` (btree, unique=f): `CREATE INDEX assignments_review_queue_idx ON public.assignments USING btree (class_id, created_at) WHERE (status = 'pending_review'::text)`
- **Index** `assignments_search_idx` (gin, unique=f): `CREATE INDEX assignments_search_idx ON public.assignments USING gin (search_vector)`
- **Index** `assignments_subject_idx` (btree, unique=f): `CREATE INDEX assignments_subject_idx ON public.assignments USING btree (subject_id) WHERE (subject_id IS NOT NULL)`
- **Index** `assignments_tags_idx` (gin, unique=f): `CREATE INDEX assignments_tags_idx ON public.assignments USING gin (tags)`
- **Trigger** `assignments_owner_immutable` enabled=O: `CREATE TRIGGER assignments_owner_immutable BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION prevent_assignment_owner_change()`
- **Trigger** `assignments_public_review_notify` enabled=O: `CREATE TRIGGER assignments_public_review_notify AFTER INSERT OR UPDATE OF status ON public.assignments FOR EACH ROW EXECUTE FUNCTION notify_platform_admins_public_assignment()`
- **Trigger** `assignments_record_revision` enabled=O: `CREATE TRIGGER assignments_record_revision AFTER INSERT OR UPDATE OF title, description, deadline, status, course_id, class_id ON public.assignments FOR EACH ROW EXECUTE FUNCTION record_assignment_revision()`
- **Trigger** `assignments_set_updated_at` enabled=O: `CREATE TRIGGER assignments_set_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `assignments_status_guard` enabled=O: `CREATE TRIGGER assignments_status_guard BEFORE UPDATE OF status, rejection_reason, reviewed_by, reviewed_at ON public.assignments FOR EACH ROW EXECUTE FUNCTION prevent_assignment_status_escalation()`
- **Trigger** `assignments_subject_active` enabled=O: `CREATE TRIGGER assignments_subject_active BEFORE INSERT OR UPDATE OF subject_id ON public.assignments FOR EACH ROW EXECUTE FUNCTION ensure_subject_active()`
- **Trigger** `assignments_subject_in_class` enabled=O: `CREATE TRIGGER assignments_subject_in_class BEFORE INSERT OR UPDATE OF subject_id, class_id ON public.assignments FOR EACH ROW EXECUTE FUNCTION ensure_subject_in_class()`
- **Trigger** `assignments_sync_archived_at` enabled=O: `CREATE TRIGGER assignments_sync_archived_at BEFORE UPDATE OF status ON public.assignments FOR EACH ROW EXECUTE FUNCTION sync_assignment_archived_at()`
- **RLS policies:** 8 â€” `assignments_class_member_read`, `assignments_class_reviewer_read`, `assignments_owner_delete`, `assignments_owner_insert`, `assignments_owner_read`, `assignments_owner_update`, `assignments_platform_review_read`, `assignments_public_read`

### `attendance_correction_audits`

- **Primary key** `attendance_correction_audits_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `attendance_correction_audits_metadata_object`: `CHECK ((jsonb_typeof(metadata) = 'object'::text))` validated=t
- **Check** `attendance_correction_audits_method`: `CHECK ((verification_method = ANY (ARRAY['manual'::text, 'physical'::text])))` validated=t
- **Check** `attendance_correction_audits_new_status`: `CHECK ((new_status = ANY (ARRAY['present'::text, 'late'::text, 'excused'::text, 'sick'::text, 'absent'::text])))` validated=t
- **Check** `attendance_correction_audits_previous_status`: `CHECK ((previous_status = ANY (ARRAY['present'::text, 'late'::text, 'excused'::text, 'sick'::text, 'absent'::text, 'not_recorded'::text])))` validated=t
- **Check** `attendance_correction_audits_reason`: `CHECK (((char_length(btrim(reason)) >= 3) AND (char_length(btrim(reason)) <= 500)))` validated=t
- **Foreign key** `attendance_correction_audits_admin_id_fkey`: `FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `attendance_correction_audits_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `attendance_correction_audits_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES discussion_sessions(id) ON DELETE CASCADE` validated=t
- **Foreign key** `attendance_correction_audits_student_id_fkey`: `FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Foreign key** `attendance_correction_audits_subject_id_fkey`: `FOREIGN KEY (subject_id) REFERENCES class_subjects(id) ON DELETE SET NULL` validated=t
- **Index** `attendance_correction_audits_class_subject_idx` (btree, unique=f): `CREATE INDEX attendance_correction_audits_class_subject_idx ON public.attendance_correction_audits USING btree (class_id, subject_id, created_at DESC)`
- **Index** `attendance_correction_audits_pkey` (btree, unique=t): `CREATE UNIQUE INDEX attendance_correction_audits_pkey ON public.attendance_correction_audits USING btree (id)`
- **Index** `attendance_correction_audits_session_idx` (btree, unique=f): `CREATE INDEX attendance_correction_audits_session_idx ON public.attendance_correction_audits USING btree (session_id, created_at DESC)`
- **Index** `attendance_correction_audits_student_idx` (btree, unique=f): `CREATE INDEX attendance_correction_audits_student_idx ON public.attendance_correction_audits USING btree (student_id, created_at DESC)`
- **RLS policies:** 1 â€” `attendance_correction_audits_manager_read`

### `attendance_verification_attempts`

- **Primary key** `attendance_verification_attempts_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `attendance_verification_attempts_accuracy`: `CHECK (((accuracy_m IS NULL) OR (accuracy_m >= (0)::double precision)))` validated=t
- **Check** `attendance_verification_attempts_distance`: `CHECK (((distance_m IS NULL) OR (distance_m >= (0)::double precision)))` validated=t
- **Check** `attendance_verification_attempts_outcome`: `CHECK ((outcome = ANY (ARRAY['checked_in'::text, 'already_checked_in'::text, 'name_mismatch'::text, 'nim_mismatch'::text, 'identity_missing'::text, 'outside_radius'::text, 'imprecise'::text, 'closed'::text, 'not_open'::text, 'not_available'::text])))` validated=t
- **Foreign key** `attendance_verification_attempts_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES discussion_sessions(id) ON DELETE CASCADE` validated=t
- **Foreign key** `attendance_verification_attempts_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `attendance_verification_attempts_pkey` (btree, unique=t): `CREATE UNIQUE INDEX attendance_verification_attempts_pkey ON public.attendance_verification_attempts USING btree (id)`
- **Index** `attendance_verification_attempts_session_idx` (btree, unique=f): `CREATE INDEX attendance_verification_attempts_session_idx ON public.attendance_verification_attempts USING btree (session_id, created_at DESC)`
- **RLS policies:** 0

### `audit_logs`

- **Primary key** `audit_logs_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `audit_logs_action_format`: `CHECK ((action ~ '^[a-z][a-z0-9_]{2,63}$'::text))` validated=t
- **Check** `audit_logs_entity_type_format`: `CHECK ((entity_type ~ '^[a-z][a-z0-9_]{2,63}$'::text))` validated=t
- **Check** `audit_logs_metadata_object`: `CHECK ((jsonb_typeof(metadata) = 'object'::text))` validated=t
- **Foreign key** `audit_logs_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `audit_logs_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL` validated=t
- **Index** `audit_logs_actor_idx` (btree, unique=f): `CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (actor_id, created_at DESC)`
- **Index** `audit_logs_class_idx` (btree, unique=f): `CREATE INDEX audit_logs_class_idx ON public.audit_logs USING btree (class_id, created_at DESC)`
- **Index** `audit_logs_created_idx` (btree, unique=f): `CREATE INDEX audit_logs_created_idx ON public.audit_logs USING btree (created_at DESC)`
- **Index** `audit_logs_pkey` (btree, unique=t): `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)`
- **RLS policies:** 1 â€” `audit_logs_read`

### `auth_activity_events`

- **Primary key** `auth_activity_events_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `auth_activity_events_provider_format`: `CHECK (((provider IS NULL) OR (provider ~ '^[a-z][a-z0-9_]{1,31}$'::text)))` validated=t
- **Check** `auth_activity_events_reason_format`: `CHECK (((reason IS NULL) OR (reason ~ '^[a-z][a-z0-9_]{1,63}$'::text)))` validated=t
- **Check** `auth_activity_events_success_has_user`: `CHECK (((event_type <> 'sign_in_succeeded'::text) OR (user_id IS NOT NULL)))` validated=t
- **Check** `auth_activity_events_type_allowed`: `CHECK ((event_type = ANY (ARRAY['sign_in_succeeded'::text, 'sign_in_failed'::text])))` validated=t
- **Foreign key** `auth_activity_events_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `auth_activity_events_created_idx` (btree, unique=f): `CREATE INDEX auth_activity_events_created_idx ON public.auth_activity_events USING btree (created_at DESC)`
- **Index** `auth_activity_events_pkey` (btree, unique=t): `CREATE UNIQUE INDEX auth_activity_events_pkey ON public.auth_activity_events USING btree (id)`
- **Index** `auth_activity_events_type_created_idx` (btree, unique=f): `CREATE INDEX auth_activity_events_type_created_idx ON public.auth_activity_events USING btree (event_type, created_at DESC)`
- **Index** `auth_activity_events_user_created_idx` (btree, unique=f): `CREATE INDEX auth_activity_events_user_created_idx ON public.auth_activity_events USING btree (user_id, created_at DESC)`
- **RLS policies:** 0

### `class_admins`

- **Primary key** `class_admins_pkey`: `PRIMARY KEY (class_id, user_id)` validated=t
- **Foreign key** `class_admins_assigned_by_fkey`: `FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_admins_class_id_user_id_fkey`: `FOREIGN KEY (class_id, user_id) REFERENCES class_members(class_id, user_id) ON DELETE CASCADE` validated=t
- **Index** `class_admins_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_admins_pkey ON public.class_admins USING btree (class_id, user_id)`
- **Index** `class_admins_user_idx` (btree, unique=f): `CREATE INDEX class_admins_user_idx ON public.class_admins USING btree (user_id, assigned_at DESC)`
- **Trigger** `class_admins_cap_trigger` enabled=O: `CREATE TRIGGER class_admins_cap_trigger BEFORE INSERT ON public.class_admins FOR EACH ROW EXECUTE FUNCTION enforce_class_admin_cap()`
- **RLS policies:** 1 â€” `class_admins_read`

### `class_application_reviews`

- **Primary key** `class_application_reviews_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_application_reviews_decision_allowed`: `CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))` validated=t
- **Check** `class_application_reviews_note_length`: `CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 3) AND (char_length(btrim(note)) <= 2000))))` validated=t
- **Foreign key** `class_application_reviews_application_id_fkey`: `FOREIGN KEY (application_id) REFERENCES class_applications(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_application_reviews_reviewer_id_fkey`: `FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE RESTRICT` validated=t
- **Index** `class_application_reviews_application_idx` (btree, unique=f): `CREATE INDEX class_application_reviews_application_idx ON public.class_application_reviews USING btree (application_id, created_at DESC)`
- **Index** `class_application_reviews_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_application_reviews_pkey ON public.class_application_reviews USING btree (id)`
- **RLS policies:** 1 â€” `class_application_reviews_read`

### `class_applications`

- **Primary key** `class_applications_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_applications_academic_year_format`: `CHECK ((academic_year ~ '^\d{4}/\d{4}$'::text))` validated=t
- **Check** `class_applications_class_code_length`: `CHECK (((proposed_class_code IS NULL) OR ((char_length(btrim(proposed_class_code)) >= 2) AND (char_length(btrim(proposed_class_code)) <= 20))))` validated=t
- **Check** `class_applications_course_length`: `CHECK (((char_length(btrim(course_name)) >= 2) AND (char_length(btrim(course_name)) <= 120)))` validated=t
- **Check** `class_applications_decision_consistency`: `CHECK ((((status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (created_class_id IS NULL)) OR ((status = 'approved'::text) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL) AND (created_class_id IS NOT NULL)) OR ((status = 'rejected'::text) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL) AND (decision_note IS NOT NULL)) OR ((status = 'withdrawn'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (created_class_id IS NULL))))` validated=t
- **Check** `class_applications_decision_note_length`: `CHECK (((decision_note IS NULL) OR ((char_length(btrim(decision_note)) >= 3) AND (char_length(btrim(decision_note)) <= 2000))))` validated=t
- **Check** `class_applications_description_length`: `CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 5000)))` validated=t
- **Check** `class_applications_institution_length`: `CHECK (((institution IS NULL) OR ((char_length(btrim(institution)) >= 2) AND (char_length(btrim(institution)) <= 120))))` validated=t
- **Check** `class_applications_lecturer_length`: `CHECK (((lecturer_name IS NULL) OR ((char_length(btrim(lecturer_name)) >= 1) AND (char_length(btrim(lecturer_name)) <= 120))))` validated=t
- **Check** `class_applications_name_length`: `CHECK (((char_length(btrim(proposed_name)) >= 3) AND (char_length(btrim(proposed_name)) <= 120)))` validated=t
- **Check** `class_applications_reason_length`: `CHECK (((char_length(btrim(reason)) >= 10) AND (char_length(btrim(reason)) <= 2000)))` validated=t
- **Check** `class_applications_semester_length`: `CHECK (((char_length(btrim(semester)) >= 1) AND (char_length(btrim(semester)) <= 20)))` validated=t
- **Check** `class_applications_slug_format`: `CHECK (((proposed_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length(proposed_slug) >= 3) AND (char_length(proposed_slug) <= 80))))` validated=t
- **Check** `class_applications_status_allowed`: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text])))` validated=t
- **Check** `class_applications_supporting_length`: `CHECK (((supporting_info IS NULL) OR (char_length(btrim(supporting_info)) <= 2000)))` validated=t
- **Foreign key** `class_applications_applicant_id_fkey`: `FOREIGN KEY (applicant_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_applications_created_class_id_fkey`: `FOREIGN KEY (created_class_id) REFERENCES classes(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_applications_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `class_applications_applicant_idx` (btree, unique=f): `CREATE INDEX class_applications_applicant_idx ON public.class_applications USING btree (applicant_id, created_at DESC)`
- **Index** `class_applications_open_applicant_key` (btree, unique=t): `CREATE UNIQUE INDEX class_applications_open_applicant_key ON public.class_applications USING btree (applicant_id, proposed_slug) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]))`
- **Index** `class_applications_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_applications_pkey ON public.class_applications USING btree (id)`
- **Index** `class_applications_status_idx` (btree, unique=f): `CREATE INDEX class_applications_status_idx ON public.class_applications USING btree (status, created_at DESC)`
- **Trigger** `class_applications_set_updated_at` enabled=O: `CREATE TRIGGER class_applications_set_updated_at BEFORE UPDATE ON public.class_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `class_applications_read`

### `class_calendar_events`

- **Primary key** `class_calendar_events_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_calendar_events_description_length`: `CHECK (((description IS NULL) OR ((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 5000))))` validated=t
- **Check** `class_calendar_events_location_length`: `CHECK (((location IS NULL) OR ((char_length(btrim(location)) >= 1) AND (char_length(btrim(location)) <= 200))))` validated=t
- **Check** `class_calendar_events_status_allowed`: `CHECK ((status = ANY (ARRAY['published'::text, 'cancelled'::text, 'archived'::text])))` validated=t
- **Check** `class_calendar_events_time_zone_length`: `CHECK (((char_length(btrim(time_zone)) >= 1) AND (char_length(btrim(time_zone)) <= 64)))` validated=t
- **Check** `class_calendar_events_title_length`: `CHECK (((char_length(btrim(title)) >= 3) AND (char_length(btrim(title)) <= 160)))` validated=t
- **Check** `class_calendar_events_type_allowed`: `CHECK ((event_type = ANY (ARRAY['class_schedule'::text, 'exam'::text, 'academic_event'::text])))` validated=t
- **Check** `class_calendar_events_visibility_allowed`: `CHECK ((visibility = 'group'::text))` validated=t
- **Check** `class_calendar_events_window`: `CHECK (((ends_at > starts_at) AND (ends_at <= (starts_at + '7 days'::interval))))` validated=t
- **Foreign key** `class_calendar_events_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_calendar_events_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_calendar_events_subject_id_fkey`: `FOREIGN KEY (subject_id) REFERENCES class_subjects(id) ON DELETE SET NULL` validated=t
- **Index** `class_calendar_events_class_start_idx` (btree, unique=f): `CREATE INDEX class_calendar_events_class_start_idx ON public.class_calendar_events USING btree (class_id, starts_at)`
- **Index** `class_calendar_events_live_idx` (btree, unique=f): `CREATE INDEX class_calendar_events_live_idx ON public.class_calendar_events USING btree (class_id, starts_at) WHERE (status <> 'archived'::text)`
- **Index** `class_calendar_events_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_calendar_events_pkey ON public.class_calendar_events USING btree (id)`
- **Index** `class_calendar_events_subject_start_idx` (btree, unique=f): `CREATE INDEX class_calendar_events_subject_start_idx ON public.class_calendar_events USING btree (subject_id, starts_at) WHERE (subject_id IS NOT NULL)`
- **Trigger** `class_calendar_events_set_updated_at` enabled=O: `CREATE TRIGGER class_calendar_events_set_updated_at BEFORE UPDATE ON public.class_calendar_events FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `class_calendar_events_subject_check` enabled=O: `CREATE TRIGGER class_calendar_events_subject_check BEFORE INSERT OR UPDATE OF subject_id, class_id ON public.class_calendar_events FOR EACH ROW EXECUTE FUNCTION ensure_class_calendar_event_subject()`
- **Trigger** `class_calendar_events_subject_in_class` enabled=O: `CREATE TRIGGER class_calendar_events_subject_in_class BEFORE INSERT OR UPDATE OF subject_id, class_id ON public.class_calendar_events FOR EACH ROW EXECUTE FUNCTION ensure_subject_in_class()`
- **RLS policies:** 4 â€” `class_calendar_events_admin_delete`, `class_calendar_events_admin_insert`, `class_calendar_events_admin_update`, `class_calendar_events_member_read`

### `class_course_schedules`

- **Primary key** `class_course_schedules_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_course_schedules_date_range`: `CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date)))` validated=t
- **Check** `class_course_schedules_day_allowed`: `CHECK (((day_of_week >= 1) AND (day_of_week <= 7)))` validated=t
- **Check** `class_course_schedules_lecturer_length`: `CHECK (((lecturer_name IS NULL) OR ((char_length(btrim(lecturer_name)) >= 1) AND (char_length(btrim(lecturer_name)) <= 120))))` validated=t
- **Check** `class_course_schedules_period_length`: `CHECK (((period IS NULL) OR ((char_length(btrim(period)) >= 1) AND (char_length(btrim(period)) <= 20))))` validated=t
- **Check** `class_course_schedules_room_length`: `CHECK (((room IS NULL) OR ((char_length(btrim(room)) >= 1) AND (char_length(btrim(room)) <= 120))))` validated=t
- **Check** `class_course_schedules_time_window`: `CHECK ((end_time > start_time))` validated=t
- **Foreign key** `class_course_schedules_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_course_schedules_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_course_schedules_subject_id_fkey`: `FOREIGN KEY (subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE` validated=t
- **Index** `class_course_schedules_class_day_idx` (btree, unique=f): `CREATE INDEX class_course_schedules_class_day_idx ON public.class_course_schedules USING btree (class_id, day_of_week, start_time)`
- **Index** `class_course_schedules_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_course_schedules_pkey ON public.class_course_schedules USING btree (id)`
- **Index** `class_course_schedules_subject_idx` (btree, unique=f): `CREATE INDEX class_course_schedules_subject_idx ON public.class_course_schedules USING btree (subject_id)`
- **Trigger** `class_course_schedules_set_updated_at` enabled=O: `CREATE TRIGGER class_course_schedules_set_updated_at BEFORE UPDATE ON public.class_course_schedules FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `class_course_schedules_subject_active` enabled=O: `CREATE TRIGGER class_course_schedules_subject_active BEFORE INSERT OR UPDATE OF subject_id ON public.class_course_schedules FOR EACH ROW EXECUTE FUNCTION ensure_subject_active()`
- **Trigger** `class_course_schedules_subject_in_class` enabled=O: `CREATE TRIGGER class_course_schedules_subject_in_class BEFORE INSERT OR UPDATE OF subject_id, class_id ON public.class_course_schedules FOR EACH ROW EXECUTE FUNCTION ensure_subject_in_class()`
- **RLS policies:** 4 â€” `class_course_schedules_member_delete`, `class_course_schedules_member_insert`, `class_course_schedules_member_read`, `class_course_schedules_member_update`

### `class_invitation_acceptances`

- **Primary key** `class_invitation_acceptances_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `class_invitation_acceptances_key`: `UNIQUE (invitation_id, user_id)` validated=t
- **Foreign key** `class_invitation_acceptances_invitation_id_fkey`: `FOREIGN KEY (invitation_id) REFERENCES class_invitations(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_invitation_acceptances_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `class_invitation_acceptances_key` (btree, unique=t): `CREATE UNIQUE INDEX class_invitation_acceptances_key ON public.class_invitation_acceptances USING btree (invitation_id, user_id)`
- **Index** `class_invitation_acceptances_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_invitation_acceptances_pkey ON public.class_invitation_acceptances USING btree (id)`
- **RLS policies:** 1 â€” `class_invitation_acceptances_read`

### `class_invitation_declines`

- **Primary key** `class_invitation_declines_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `class_invitation_declines_key`: `UNIQUE (invitation_id, user_id)` validated=t
- **Foreign key** `class_invitation_declines_invitation_id_fkey`: `FOREIGN KEY (invitation_id) REFERENCES class_invitations(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_invitation_declines_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `class_invitation_declines_key` (btree, unique=t): `CREATE UNIQUE INDEX class_invitation_declines_key ON public.class_invitation_declines USING btree (invitation_id, user_id)`
- **Index** `class_invitation_declines_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_invitation_declines_pkey ON public.class_invitation_declines USING btree (id)`
- **Index** `class_invitation_declines_user_idx` (btree, unique=f): `CREATE INDEX class_invitation_declines_user_idx ON public.class_invitation_declines USING btree (user_id)`
- **RLS policies:** 2 â€” `class_invitation_declines_user_insert`, `class_invitation_declines_user_read`

### `class_invitations`

- **Primary key** `class_invitations_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `class_invitations_token_hash_key`: `UNIQUE (token_hash)` validated=t
- **Check** `class_invitations_email_format`: `CHECK (((email_restriction IS NULL) OR (email_restriction ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)))` validated=t
- **Check** `class_invitations_expiry_after_creation`: `CHECK ((expires_at > created_at))` validated=t
- **Check** `class_invitations_max_uses_range`: `CHECK (((max_uses >= 1) AND (max_uses <= 500)))` validated=t
- **Check** `class_invitations_token_hash_length`: `CHECK ((char_length(token_hash) = 64))` validated=t
- **Check** `class_invitations_used_within_max`: `CHECK (((used_count >= 0) AND (used_count <= max_uses)))` validated=t
- **Foreign key** `class_invitations_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_invitations_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_invitations_revoked_by_fkey`: `FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `class_invitations_class_idx` (btree, unique=f): `CREATE INDEX class_invitations_class_idx ON public.class_invitations USING btree (class_id, created_at DESC)`
- **Index** `class_invitations_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_invitations_pkey ON public.class_invitations USING btree (id)`
- **Index** `class_invitations_token_hash_key` (btree, unique=t): `CREATE UNIQUE INDEX class_invitations_token_hash_key ON public.class_invitations USING btree (token_hash)`
- **RLS policies:** 1 â€” `class_invitations_read`

### `class_members`

- **Primary key** `class_members_pkey`: `PRIMARY KEY (class_id, user_id)` validated=t
- **Check** `class_members_joined_via_allowed`: `CHECK ((joined_via = ANY (ARRAY['invitation'::text, 'admin_assignment'::text, 'platform_assignment'::text, 'name_match'::text])))` validated=t
- **Foreign key** `class_members_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_members_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `class_members_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_members_pkey ON public.class_members USING btree (class_id, user_id)`
- **Index** `class_members_user_idx` (btree, unique=f): `CREATE INDEX class_members_user_idx ON public.class_members USING btree (user_id, joined_at DESC)`
- **RLS policies:** 1 â€” `class_members_read`

### `class_subjects`

- **Primary key** `class_subjects_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_subjects_code_length`: `CHECK (((code IS NULL) OR ((char_length(btrim(code)) >= 1) AND (char_length(btrim(code)) <= 20))))` validated=t
- **Check** `class_subjects_description_length`: `CHECK (((description IS NULL) OR ((char_length(btrim(description)) >= 3) AND (char_length(btrim(description)) <= 2000))))` validated=t
- **Check** `class_subjects_lecturer_length`: `CHECK (((lecturer_name IS NULL) OR ((char_length(btrim(lecturer_name)) >= 1) AND (char_length(btrim(lecturer_name)) <= 120))))` validated=t
- **Check** `class_subjects_name_length`: `CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 120)))` validated=t
- **Check** `class_subjects_status_allowed`: `CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))` validated=t
- **Foreign key** `class_subjects_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_subjects_course_id_fkey`: `FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_subjects_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `class_subjects_class_code_uniq` (btree, unique=t): `CREATE UNIQUE INDEX class_subjects_class_code_uniq ON public.class_subjects USING btree (class_id, lower(btrim(code))) WHERE (code IS NOT NULL)`
- **Index** `class_subjects_class_idx` (btree, unique=f): `CREATE INDEX class_subjects_class_idx ON public.class_subjects USING btree (class_id, created_at)`
- **Index** `class_subjects_course_idx` (btree, unique=f): `CREATE INDEX class_subjects_course_idx ON public.class_subjects USING btree (course_id)`
- **Index** `class_subjects_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_subjects_pkey ON public.class_subjects USING btree (id)`
- **Trigger** `class_subjects_set_updated_at` enabled=O: `CREATE TRIGGER class_subjects_set_updated_at BEFORE UPDATE ON public.class_subjects FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 4 â€” `class_subjects_authenticated_read`, `class_subjects_manage_insert`, `class_subjects_manage_update`, `class_subjects_public_read`

### `class_verification_evidence`

- **Primary key** `class_verification_evidence_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `class_verification_evidence_path_key`: `UNIQUE (storage_path)` validated=t
- **Check** `class_verification_evidence_filename_length`: `CHECK (((char_length(btrim(original_filename)) >= 1) AND (char_length(btrim(original_filename)) <= 200)))` validated=t
- **Check** `class_verification_evidence_mime_allowed`: `CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])))` validated=t
- **Check** `class_verification_evidence_path_length`: `CHECK (((char_length(storage_path) >= 10) AND (char_length(storage_path) <= 500)))` validated=t
- **Check** `class_verification_evidence_removal_pair`: `CHECK (((removed_at IS NULL) = (removed_by IS NULL)))` validated=t
- **Check** `class_verification_evidence_size_range`: `CHECK (((file_size >= 1) AND (file_size <= 10485760)))` validated=t
- **Foreign key** `class_verification_evidence_removed_by_fkey`: `FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_verification_evidence_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES class_verification_requests(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_verification_evidence_uploaded_by_fkey`: `FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `class_verification_evidence_path_key` (btree, unique=t): `CREATE UNIQUE INDEX class_verification_evidence_path_key ON public.class_verification_evidence USING btree (storage_path)`
- **Index** `class_verification_evidence_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_verification_evidence_pkey ON public.class_verification_evidence USING btree (id)`
- **Index** `class_verification_evidence_request_idx` (btree, unique=f): `CREATE INDEX class_verification_evidence_request_idx ON public.class_verification_evidence USING btree (request_id) WHERE (removed_at IS NULL)`
- **RLS policies:** 1 â€” `class_verification_evidence_select`

### `class_verification_requests`

- **Primary key** `class_verification_requests_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_verification_requests_decision_consistency`: `CHECK ((((status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_note IS NULL)) OR ((status = ANY (ARRAY['needs_revision'::text, 'rejected'::text])) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL) AND (review_note IS NOT NULL)) OR ((status = 'verified'::text) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL))))` validated=t
- **Check** `class_verification_requests_no_self_review`: `CHECK (((reviewed_by IS NULL) OR (reviewed_by <> student_id)))` validated=t
- **Check** `class_verification_requests_note_length`: `CHECK (((review_note IS NULL) OR ((char_length(btrim(review_note)) >= 3) AND (char_length(btrim(review_note)) <= 2000))))` validated=t
- **Check** `class_verification_requests_position_allowed`: `CHECK ((declared_position = 'class_representative'::text))` validated=t
- **Check** `class_verification_requests_revision_range`: `CHECK (((revision_count >= 0) AND (revision_count <= 100)))` validated=t
- **Check** `class_verification_requests_statement_length`: `CHECK (((statement IS NULL) OR ((char_length(btrim(statement)) >= 10) AND (char_length(btrim(statement)) <= 2000))))` validated=t
- **Check** `class_verification_requests_status_allowed`: `CHECK ((status = ANY (ARRAY['pending'::text, 'needs_revision'::text, 'verified'::text, 'rejected'::text])))` validated=t
- **Check** `class_verification_requests_submitted_consistency`: `CHECK (((status = 'pending'::text) OR (submitted_at IS NOT NULL)))` validated=t
- **Foreign key** `class_verification_requests_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `class_verification_requests_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_verification_requests_student_id_fkey`: `FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `class_verification_requests_active_key` (btree, unique=t): `CREATE UNIQUE INDEX class_verification_requests_active_key ON public.class_verification_requests USING btree (student_id, class_id) WHERE (status = ANY (ARRAY['pending'::text, 'needs_revision'::text, 'verified'::text]))`
- **Index** `class_verification_requests_class_idx` (btree, unique=f): `CREATE INDEX class_verification_requests_class_idx ON public.class_verification_requests USING btree (class_id, created_at DESC)`
- **Index** `class_verification_requests_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_verification_requests_pkey ON public.class_verification_requests USING btree (id)`
- **Index** `class_verification_requests_queue_idx` (btree, unique=f): `CREATE INDEX class_verification_requests_queue_idx ON public.class_verification_requests USING btree (status, submitted_at DESC) WHERE (submitted_at IS NOT NULL)`
- **Index** `class_verification_requests_student_idx` (btree, unique=f): `CREATE INDEX class_verification_requests_student_idx ON public.class_verification_requests USING btree (student_id, created_at DESC)`
- **Trigger** `class_verification_requests_set_updated_at` enabled=O: `CREATE TRIGGER class_verification_requests_set_updated_at BEFORE UPDATE ON public.class_verification_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `class_verification_requests_select`

### `class_verification_reviews`

- **Primary key** `class_verification_reviews_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `class_verification_reviews_action_allowed`: `CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'submitted'::text, 'resubmitted'::text, 'evidence_added'::text, 'evidence_removed'::text, 'revision_requested'::text, 'approved'::text, 'rejected'::text, 'access_revoked'::text])))` validated=t
- **Check** `class_verification_reviews_metadata_object`: `CHECK ((jsonb_typeof(metadata) = 'object'::text))` validated=t
- **Check** `class_verification_reviews_note_length`: `CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 2000))))` validated=t
- **Check** `class_verification_reviews_status_allowed`: `CHECK ((((previous_status IS NULL) OR (previous_status = ANY (ARRAY['pending'::text, 'needs_revision'::text, 'verified'::text, 'rejected'::text]))) AND ((new_status IS NULL) OR (new_status = ANY (ARRAY['pending'::text, 'needs_revision'::text, 'verified'::text, 'rejected'::text])))))` validated=t
- **Foreign key** `class_verification_reviews_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `class_verification_reviews_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES class_verification_requests(id) ON DELETE CASCADE` validated=t
- **Index** `class_verification_reviews_pkey` (btree, unique=t): `CREATE UNIQUE INDEX class_verification_reviews_pkey ON public.class_verification_reviews USING btree (id)`
- **Index** `class_verification_reviews_request_idx` (btree, unique=f): `CREATE INDEX class_verification_reviews_request_idx ON public.class_verification_reviews USING btree (request_id, created_at)`
- **RLS policies:** 1 â€” `class_verification_reviews_select`

### `classes`

- **Primary key** `classes_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `classes_academic_year_format`: `CHECK ((academic_year ~ '^\d{4}/\d{4}$'::text))` validated=t
- **Check** `classes_avatar_url_https`: `CHECK (((avatar_url IS NULL) OR (avatar_url ~ '^https://[^[:space:]]+$'::text)))` validated=t
- **Check** `classes_class_code_length`: `CHECK (((class_code IS NULL) OR ((char_length(btrim(class_code)) >= 2) AND (char_length(btrim(class_code)) <= 20))))` validated=t
- **Check** `classes_course_name_length`: `CHECK (((char_length(btrim(course_name)) >= 2) AND (char_length(btrim(course_name)) <= 120)))` validated=t
- **Check** `classes_cover_url_https`: `CHECK (((cover_url IS NULL) OR (cover_url ~ '^https://[^[:space:]]+$'::text)))` validated=t
- **Check** `classes_description_length`: `CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 5000)))` validated=t
- **Check** `classes_institution_length`: `CHECK (((institution IS NULL) OR ((char_length(btrim(institution)) >= 2) AND (char_length(btrim(institution)) <= 120))))` validated=t
- **Check** `classes_join_policy_allowed`: `CHECK ((join_policy = ANY (ARRAY['invitation'::text, 'open'::text])))` validated=t
- **Check** `classes_lecturer_length`: `CHECK (((lecturer_name IS NULL) OR ((char_length(btrim(lecturer_name)) >= 1) AND (char_length(btrim(lecturer_name)) <= 120))))` validated=t
- **Check** `classes_name_length`: `CHECK (((char_length(btrim(name)) >= 3) AND (char_length(btrim(name)) <= 120)))` validated=t
- **Check** `classes_semester_length`: `CHECK (((char_length(btrim(semester)) >= 1) AND (char_length(btrim(semester)) <= 20)))` validated=t
- **Check** `classes_slug_format`: `CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length(slug) >= 3) AND (char_length(slug) <= 80))))` validated=t
- **Check** `classes_status_allowed`: `CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))` validated=t
- **Foreign key** `classes_archived_by_fkey`: `FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `classes_course_id_fkey`: `FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT` validated=t
- **Foreign key** `classes_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `classes_active_recent_idx` (btree, unique=f): `CREATE INDEX classes_active_recent_idx ON public.classes USING btree (created_at DESC) WHERE (status = 'active'::text)`
- **Index** `classes_course_idx` (btree, unique=f): `CREATE INDEX classes_course_idx ON public.classes USING btree (course_id) WHERE (status = 'active'::text)`
- **Index** `classes_period_code_key` (btree, unique=t): `CREATE UNIQUE INDEX classes_period_code_key ON public.classes USING btree (class_code_normalized, academic_year, semester, COALESCE(institution_normalized, ''::text)) WHERE (class_code_normalized IS NOT NULL)`
- **Index** `classes_period_idx` (btree, unique=f): `CREATE INDEX classes_period_idx ON public.classes USING btree (academic_year, semester, status)`
- **Index** `classes_pkey` (btree, unique=t): `CREATE UNIQUE INDEX classes_pkey ON public.classes USING btree (id)`
- **Index** `classes_semester_idx` (btree, unique=f): `CREATE INDEX classes_semester_idx ON public.classes USING btree (semester) WHERE (status = 'active'::text)`
- **Index** `classes_slug_key` (btree, unique=t): `CREATE UNIQUE INDEX classes_slug_key ON public.classes USING btree (slug)`
- **Trigger** `classes_set_updated_at` enabled=O: `CREATE TRIGGER classes_set_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `classes_sync_archived_at` enabled=O: `CREATE TRIGGER classes_sync_archived_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION sync_class_archived_at()`
- **RLS policies:** 1 â€” `classes_read`

### `course_materials`

- **Primary key** `course_materials_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `course_materials_description_length`: `CHECK (((description IS NULL) OR ((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 5000))))` validated=t
- **Check** `course_materials_has_content`: `CHECK (((description IS NOT NULL) OR (resource_url IS NOT NULL)))` validated=t
- **Check** `course_materials_kind_allowed`: `CHECK ((kind = ANY (ARRAY['document'::text, 'video'::text, 'link'::text, 'other'::text])))` validated=t
- **Check** `course_materials_title_length`: `CHECK (((char_length(btrim(title)) >= 3) AND (char_length(btrim(title)) <= 200)))` validated=t
- **Check** `course_materials_url_https`: `CHECK (((resource_url IS NULL) OR ((resource_url ~ '^https://[^[:space:]]+$'::text) AND ((char_length(resource_url) >= 16) AND (char_length(resource_url) <= 2048)))))` validated=t
- **Foreign key** `course_materials_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `course_materials_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `course_materials_subject_id_fkey`: `FOREIGN KEY (subject_id) REFERENCES class_subjects(id) ON DELETE CASCADE` validated=t
- **Index** `course_materials_pkey` (btree, unique=t): `CREATE UNIQUE INDEX course_materials_pkey ON public.course_materials USING btree (id)`
- **Index** `course_materials_subject_idx` (btree, unique=f): `CREATE INDEX course_materials_subject_idx ON public.course_materials USING btree (subject_id, created_at DESC)`
- **Trigger** `course_materials_set_updated_at` enabled=O: `CREATE TRIGGER course_materials_set_updated_at BEFORE UPDATE ON public.course_materials FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `course_materials_subject_active` enabled=O: `CREATE TRIGGER course_materials_subject_active BEFORE INSERT OR UPDATE OF subject_id ON public.course_materials FOR EACH ROW EXECUTE FUNCTION ensure_subject_active()`
- **Trigger** `course_materials_subject_in_class` enabled=O: `CREATE TRIGGER course_materials_subject_in_class BEFORE INSERT OR UPDATE OF subject_id, class_id ON public.course_materials FOR EACH ROW EXECUTE FUNCTION ensure_subject_in_class()`
- **RLS policies:** 4 â€” `course_materials_manager_delete`, `course_materials_manager_insert`, `course_materials_manager_update`, `course_materials_member_read`

### `courses`

- **Primary key** `courses_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `courses_code_length`: `CHECK (((code IS NULL) OR ((char_length(btrim(code)) >= 1) AND (char_length(btrim(code)) <= 20))))` validated=t
- **Check** `courses_department_length`: `CHECK (((department IS NULL) OR ((char_length(btrim(department)) >= 2) AND (char_length(btrim(department)) <= 120))))` validated=t
- **Check** `courses_name_length`: `CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 120)))` validated=t
- **Index** `courses_normalized_code_idx` (btree, unique=f): `CREATE INDEX courses_normalized_code_idx ON public.courses USING btree (normalized_code) WHERE (normalized_code IS NOT NULL)`
- **Index** `courses_normalized_name_key` (btree, unique=t): `CREATE UNIQUE INDEX courses_normalized_name_key ON public.courses USING btree (normalized_name)`
- **Index** `courses_pkey` (btree, unique=t): `CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id)`
- **RLS policies:** 1 â€” `courses_public_read`

### `developer_incident_notes`

- **Primary key** `developer_incident_notes_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `developer_incident_notes_body_length`: `CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)))` validated=t
- **Foreign key** `developer_incident_notes_author_id_fkey`: `FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `developer_incident_notes_incident_id_fkey`: `FOREIGN KEY (incident_id) REFERENCES developer_incidents(id) ON DELETE CASCADE` validated=t
- **Index** `developer_incident_notes_incident_idx` (btree, unique=f): `CREATE INDEX developer_incident_notes_incident_idx ON public.developer_incident_notes USING btree (incident_id, created_at DESC)`
- **Index** `developer_incident_notes_pkey` (btree, unique=t): `CREATE UNIQUE INDEX developer_incident_notes_pkey ON public.developer_incident_notes USING btree (id)`
- **RLS policies:** 0

### `developer_incidents`

- **Primary key** `developer_incidents_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `developer_incidents_resolved_shape`: `CHECK ((((status = 'resolved'::text) AND (resolved_at IS NOT NULL)) OR ((status <> 'resolved'::text) AND (resolved_at IS NULL))))` validated=t
- **Check** `developer_incidents_severity_allowed`: `CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))` validated=t
- **Check** `developer_incidents_status_allowed`: `CHECK ((status = ANY (ARRAY['open'::text, 'monitoring'::text, 'resolved'::text])))` validated=t
- **Check** `developer_incidents_title_length`: `CHECK (((char_length(title) >= 3) AND (char_length(title) <= 160)))` validated=t
- **Foreign key** `developer_incidents_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `developer_incidents_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `developer_incidents_created_idx` (btree, unique=f): `CREATE INDEX developer_incidents_created_idx ON public.developer_incidents USING btree (created_at DESC)`
- **Index** `developer_incidents_pkey` (btree, unique=t): `CREATE UNIQUE INDEX developer_incidents_pkey ON public.developer_incidents USING btree (id)`
- **Index** `developer_incidents_status_created_idx` (btree, unique=f): `CREATE INDEX developer_incidents_status_created_idx ON public.developer_incidents USING btree (status, created_at DESC)`
- **RLS policies:** 0

### `discussion_session_checkins`

- **Primary key** `discussion_session_checkins_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `discussion_session_checkins_one_per_user`: `UNIQUE (session_id, user_id)` validated=t
- **Check** `discussion_session_checkins_accuracy`: `CHECK (((accuracy_m IS NULL) OR (accuracy_m >= (0)::double precision)))` validated=t
- **Check** `discussion_session_checkins_distance`: `CHECK (((distance_m IS NULL) OR (distance_m >= (0)::double precision)))` validated=t
- **Check** `discussion_session_checkins_geo_fields`: `CHECK (((method = ANY (ARRAY['manual'::text, 'system'::text])) OR (((latitude IS NOT NULL) AND (longitude IS NOT NULL) AND (accuracy_m IS NOT NULL) AND (distance_m IS NOT NULL)) OR ((coordinates_purged_at IS NOT NULL) AND (latitude IS NULL) AND (longitude IS NULL)))))` validated=t
- **Check** `discussion_session_checkins_method_allowed`: `CHECK ((method = ANY (ARRAY['geo'::text, 'manual'::text, 'system'::text])))` validated=t
- **Check** `discussion_session_checkins_note_length`: `CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 500))))` validated=t
- **Check** `discussion_session_checkins_status_allowed`: `CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'excused'::text, 'sick'::text, 'absent'::text])))` validated=t
- **Foreign key** `discussion_session_checkins_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `discussion_session_checkins_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES discussion_sessions(id) ON DELETE CASCADE` validated=t
- **Foreign key** `discussion_session_checkins_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `discussion_session_checkins_one_per_user` (btree, unique=t): `CREATE UNIQUE INDEX discussion_session_checkins_one_per_user ON public.discussion_session_checkins USING btree (session_id, user_id)`
- **Index** `discussion_session_checkins_pkey` (btree, unique=t): `CREATE UNIQUE INDEX discussion_session_checkins_pkey ON public.discussion_session_checkins USING btree (id)`
- **Index** `discussion_session_checkins_retention_idx` (btree, unique=f): `CREATE INDEX discussion_session_checkins_retention_idx ON public.discussion_session_checkins USING btree (session_id) WHERE ((latitude IS NOT NULL) AND (coordinates_purged_at IS NULL))`
- **Index** `discussion_session_checkins_session_idx` (btree, unique=f): `CREATE INDEX discussion_session_checkins_session_idx ON public.discussion_session_checkins USING btree (session_id, status, checked_in_at)`
- **Index** `discussion_session_checkins_user_idx` (btree, unique=f): `CREATE INDEX discussion_session_checkins_user_idx ON public.discussion_session_checkins USING btree (user_id, checked_in_at DESC)`
- **RLS policies:** 1 â€” `discussion_session_checkins_select`

### `discussion_session_reminders`

- **Primary key** `discussion_session_reminders_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `discussion_session_reminders_dedupe`: `UNIQUE (user_id, session_id, reminder_type, starts_at)` validated=t
- **Check** `discussion_session_reminders_attempts_range`: `CHECK (((attempt_count >= 0) AND (attempt_count <= 10)))` validated=t
- **Check** `discussion_session_reminders_error_length`: `CHECK (((last_error_category IS NULL) OR ((char_length(last_error_category) >= 1) AND (char_length(last_error_category) <= 40))))` validated=t
- **Check** `discussion_session_reminders_status_allowed`: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))` validated=t
- **Check** `discussion_session_reminders_type_allowed`: `CHECK ((reminder_type = ANY (ARRAY['24h'::text, '3h'::text])))` validated=t
- **Foreign key** `discussion_session_reminders_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES discussion_sessions(id) ON DELETE CASCADE` validated=t
- **Foreign key** `discussion_session_reminders_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `discussion_session_reminders_dedupe` (btree, unique=t): `CREATE UNIQUE INDEX discussion_session_reminders_dedupe ON public.discussion_session_reminders USING btree (user_id, session_id, reminder_type, starts_at)`
- **Index** `discussion_session_reminders_due_idx` (btree, unique=f): `CREATE INDEX discussion_session_reminders_due_idx ON public.discussion_session_reminders USING btree (status, next_attempt_at)`
- **Index** `discussion_session_reminders_pkey` (btree, unique=t): `CREATE UNIQUE INDEX discussion_session_reminders_pkey ON public.discussion_session_reminders USING btree (id)`
- **Index** `discussion_session_reminders_user_idx` (btree, unique=f): `CREATE INDEX discussion_session_reminders_user_idx ON public.discussion_session_reminders USING btree (user_id, created_at DESC)`
- **Trigger** `discussion_session_reminders_set_updated_at` enabled=O: `CREATE TRIGGER discussion_session_reminders_set_updated_at BEFORE UPDATE ON public.discussion_session_reminders FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 0

### `discussion_session_rsvps`

- **Primary key** `discussion_session_rsvps_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `discussion_session_rsvps_unique`: `UNIQUE (session_id, user_id)` validated=t
- **Check** `discussion_session_rsvps_status_allowed`: `CHECK ((status = ANY (ARRAY['going'::text, 'maybe'::text, 'not_going'::text])))` validated=t
- **Foreign key** `discussion_session_rsvps_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES discussion_sessions(id) ON DELETE CASCADE` validated=t
- **Foreign key** `discussion_session_rsvps_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `discussion_session_rsvps_pkey` (btree, unique=t): `CREATE UNIQUE INDEX discussion_session_rsvps_pkey ON public.discussion_session_rsvps USING btree (id)`
- **Index** `discussion_session_rsvps_session_idx` (btree, unique=f): `CREATE INDEX discussion_session_rsvps_session_idx ON public.discussion_session_rsvps USING btree (session_id, status)`
- **Index** `discussion_session_rsvps_unique` (btree, unique=t): `CREATE UNIQUE INDEX discussion_session_rsvps_unique ON public.discussion_session_rsvps USING btree (session_id, user_id)`
- **Index** `discussion_session_rsvps_user_idx` (btree, unique=f): `CREATE INDEX discussion_session_rsvps_user_idx ON public.discussion_session_rsvps USING btree (user_id, updated_at DESC)`
- **Trigger** `discussion_session_rsvps_set_updated_at` enabled=O: `CREATE TRIGGER discussion_session_rsvps_set_updated_at BEFORE UPDATE ON public.discussion_session_rsvps FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `discussion_session_rsvps_read`

### `discussion_sessions`

- **Primary key** `discussion_sessions_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `discussion_sessions_agenda_length`: `CHECK (((agenda IS NULL) OR (char_length(btrim(agenda)) <= 5000)))` validated=t
- **Check** `discussion_sessions_attendance_state`: `CHECK ((((attendance_closed_at IS NULL) OR (attendance_opened_at IS NOT NULL)) AND ((attendance_finalized_at IS NULL) OR (attendance_closed_at IS NOT NULL))))` validated=t
- **Check** `discussion_sessions_attendance_window`: `CHECK (((attendance_opens_at IS NULL) OR (attendance_closes_at IS NULL) OR (attendance_closes_at > attendance_opens_at)))` validated=t
- **Check** `discussion_sessions_capacity_range`: `CHECK (((capacity IS NULL) OR ((capacity >= 1) AND (capacity <= 1000))))` validated=t
- **Check** `discussion_sessions_checkin_point`: `CHECK ((((checkin_latitude IS NULL) AND (checkin_longitude IS NULL)) OR (((checkin_latitude >= ('-90'::integer)::double precision) AND (checkin_latitude <= (90)::double precision)) AND ((checkin_longitude >= ('-180'::integer)::double precision) AND (checkin_longitude <= (180)::double precision)))))` validated=t
- **Check** `discussion_sessions_checkin_radius`: `CHECK (((checkin_radius_m >= 25) AND (checkin_radius_m <= 1000)))` validated=t
- **Check** `discussion_sessions_description_length`: `CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 5000)))` validated=t
- **Check** `discussion_sessions_in_person_location`: `CHECK (((session_type <> 'in_person'::text) OR ((location IS NOT NULL) AND ((char_length(btrim(location)) >= 3) AND (char_length(btrim(location)) <= 200)))))` validated=t
- **Check** `discussion_sessions_late_after_range`: `CHECK (((late_after_minutes >= 0) AND (late_after_minutes <= 240)))` validated=t
- **Check** `discussion_sessions_location_length`: `CHECK (((location IS NULL) OR ((char_length(btrim(location)) >= 1) AND (char_length(btrim(location)) <= 200))))` validated=t
- **Check** `discussion_sessions_meeting_identity`: `CHECK ((((meeting_number IS NULL) AND (subject_id IS NULL)) OR ((meeting_number IS NOT NULL) AND (subject_id IS NOT NULL))))` validated=t
- **Check** `discussion_sessions_meeting_number_range`: `CHECK (((meeting_number IS NULL) OR ((meeting_number >= 1) AND (meeting_number <= 999))))` validated=t
- **Check** `discussion_sessions_meeting_url_https`: `CHECK (((meeting_url IS NULL) OR ((meeting_url ~~ 'https://%'::text) AND ((char_length(meeting_url) >= 10) AND (char_length(meeting_url) <= 2048)))))` validated=t
- **Check** `discussion_sessions_online_url`: `CHECK (((session_type <> 'online'::text) OR ((meeting_url IS NOT NULL) AND (meeting_url ~~ 'https://%'::text) AND ((char_length(meeting_url) >= 10) AND (char_length(meeting_url) <= 2048)))))` validated=t
- **Check** `discussion_sessions_registration_window`: `CHECK (((registration_deadline IS NULL) OR (registration_deadline <= starts_at)))` validated=t
- **Check** `discussion_sessions_status_allowed`: `CHECK ((status = ANY (ARRAY['scheduled'::text, 'cancelled'::text, 'completed'::text])))` validated=t
- **Check** `discussion_sessions_status_consistency`: `CHECK ((((status = 'scheduled'::text) AND (cancelled_at IS NULL) AND (completed_at IS NULL)) OR ((status = 'cancelled'::text) AND (cancelled_at IS NOT NULL) AND (completed_at IS NULL)) OR ((status = 'completed'::text) AND (cancelled_at IS NULL) AND (completed_at IS NOT NULL))))` validated=t
- **Check** `discussion_sessions_time_zone_length`: `CHECK (((char_length(btrim(time_zone)) >= 1) AND (char_length(btrim(time_zone)) <= 64)))` validated=t
- **Check** `discussion_sessions_title_length`: `CHECK (((char_length(btrim(title)) >= 3) AND (char_length(btrim(title)) <= 160)))` validated=t
- **Check** `discussion_sessions_type_allowed`: `CHECK ((session_type = ANY (ARRAY['online'::text, 'in_person'::text])))` validated=t
- **Check** `discussion_sessions_visibility_allowed`: `CHECK ((visibility = ANY (ARRAY['class_members'::text, 'public'::text])))` validated=t
- **Check** `discussion_sessions_window`: `CHECK (((ends_at > starts_at) AND (ends_at <= (starts_at + '24:00:00'::interval))))` validated=t
- **Foreign key** `discussion_sessions_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL` validated=t
- **Foreign key** `discussion_sessions_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `discussion_sessions_organizer_id_fkey`: `FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Foreign key** `discussion_sessions_subject_id_fkey`: `FOREIGN KEY (subject_id) REFERENCES class_subjects(id) ON DELETE SET NULL` validated=t
- **Index** `discussion_sessions_assignment_idx` (btree, unique=f): `CREATE INDEX discussion_sessions_assignment_idx ON public.discussion_sessions USING btree (assignment_id) WHERE (assignment_id IS NOT NULL)`
- **Index** `discussion_sessions_attendance_open_idx` (btree, unique=f): `CREATE INDEX discussion_sessions_attendance_open_idx ON public.discussion_sessions USING btree (class_id, attendance_opened_at DESC) WHERE (meeting_number IS NOT NULL)`
- **Index** `discussion_sessions_class_idx` (btree, unique=f): `CREATE INDEX discussion_sessions_class_idx ON public.discussion_sessions USING btree (class_id, starts_at)`
- **Index** `discussion_sessions_class_subject_meeting_uniq` (btree, unique=t): `CREATE UNIQUE INDEX discussion_sessions_class_subject_meeting_uniq ON public.discussion_sessions USING btree (class_id, subject_id, meeting_number) WHERE ((meeting_number IS NOT NULL) AND (subject_id IS NOT NULL))`
- **Index** `discussion_sessions_organizer_idx` (btree, unique=f): `CREATE INDEX discussion_sessions_organizer_idx ON public.discussion_sessions USING btree (organizer_id, starts_at DESC)`
- **Index** `discussion_sessions_pkey` (btree, unique=t): `CREATE UNIQUE INDEX discussion_sessions_pkey ON public.discussion_sessions USING btree (id)`
- **Index** `discussion_sessions_public_upcoming_idx` (btree, unique=f): `CREATE INDEX discussion_sessions_public_upcoming_idx ON public.discussion_sessions USING btree (starts_at) WHERE ((status = 'scheduled'::text) AND (visibility = 'public'::text))`
- **Index** `discussion_sessions_upcoming_idx` (btree, unique=f): `CREATE INDEX discussion_sessions_upcoming_idx ON public.discussion_sessions USING btree (starts_at) WHERE (status = 'scheduled'::text)`
- **Trigger** `discussion_sessions_fill_attendance_meeting` enabled=O: `CREATE TRIGGER discussion_sessions_fill_attendance_meeting BEFORE INSERT OR UPDATE OF meeting_number, subject_id, starts_at, ends_at, time_zone ON public.discussion_sessions FOR EACH ROW EXECUTE FUNCTION discussion_sessions_fill_attendance_meeting()`
- **Trigger** `discussion_sessions_set_updated_at` enabled=O: `CREATE TRIGGER discussion_sessions_set_updated_at BEFORE UPDATE ON public.discussion_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `discussion_sessions_subject_active` enabled=O: `CREATE TRIGGER discussion_sessions_subject_active BEFORE INSERT OR UPDATE OF subject_id ON public.discussion_sessions FOR EACH ROW EXECUTE FUNCTION ensure_subject_active()`
- **Trigger** `discussion_sessions_subject_in_class` enabled=O: `CREATE TRIGGER discussion_sessions_subject_in_class BEFORE INSERT OR UPDATE OF subject_id, class_id ON public.discussion_sessions FOR EACH ROW EXECUTE FUNCTION ensure_subject_in_class()`
- **RLS policies:** 1 â€” `discussion_sessions_read`

### `feedback_entries`

- **Primary key** `feedback_entries_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `feedback_entries_category_allowed`: `CHECK ((category = ANY (ARRAY['bug'::text, 'confusing'::text, 'idea'::text, 'other'::text])))` validated=t
- **Check** `feedback_entries_message_length`: `CHECK (((char_length(btrim(message)) >= 10) AND (char_length(btrim(message)) <= 2000)))` validated=t
- **Check** `feedback_entries_page_path_length`: `CHECK (((page_path IS NULL) OR ((char_length(page_path) >= 1) AND (char_length(page_path) <= 200))))` validated=t
- **Check** `feedback_entries_status_allowed`: `CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])))` validated=t
- **Foreign key** `feedback_entries_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `feedback_entries_pkey` (btree, unique=t): `CREATE UNIQUE INDEX feedback_entries_pkey ON public.feedback_entries USING btree (id)`
- **Index** `feedback_entries_status_recent_idx` (btree, unique=f): `CREATE INDEX feedback_entries_status_recent_idx ON public.feedback_entries USING btree (status, created_at DESC)`
- **Index** `feedback_entries_user_recent_idx` (btree, unique=f): `CREATE INDEX feedback_entries_user_recent_idx ON public.feedback_entries USING btree (user_id, created_at DESC)`
- **Trigger** `feedback_entries_set_updated_at` enabled=O: `CREATE TRIGGER feedback_entries_set_updated_at BEFORE UPDATE ON public.feedback_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 4 â€” `feedback_entries_admin_read`, `feedback_entries_admin_update`, `feedback_entries_owner_insert`, `feedback_entries_owner_read`

### `google_calendar_connections`

- **Primary key** `google_calendar_connections_pkey`: `PRIMARY KEY (user_id)` validated=t
- **Check** `google_calendar_connections_access_cipher_length`: `CHECK (((char_length(access_token_ciphertext) >= 40) AND (char_length(access_token_ciphertext) <= 4000)))` validated=t
- **Check** `google_calendar_connections_calendar_id_length`: `CHECK (((char_length(btrim(calendar_id)) >= 1) AND (char_length(btrim(calendar_id)) <= 200)))` validated=t
- **Check** `google_calendar_connections_error_length`: `CHECK (((last_error_category IS NULL) OR ((char_length(last_error_category) >= 1) AND (char_length(last_error_category) <= 40))))` validated=t
- **Check** `google_calendar_connections_refresh_cipher_length`: `CHECK (((refresh_token_ciphertext IS NULL) OR ((char_length(refresh_token_ciphertext) >= 40) AND (char_length(refresh_token_ciphertext) <= 4000))))` validated=t
- **Check** `google_calendar_connections_scope_length`: `CHECK (((char_length(scope) >= 1) AND (char_length(scope) <= 500)))` validated=t
- **Check** `google_calendar_connections_status_allowed`: `CHECK ((status = ANY (ARRAY['connected'::text, 'revoked'::text, 'error'::text])))` validated=t
- **Foreign key** `google_calendar_connections_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `google_calendar_connections_pkey` (btree, unique=t): `CREATE UNIQUE INDEX google_calendar_connections_pkey ON public.google_calendar_connections USING btree (user_id)`
- **Trigger** `google_calendar_connections_set_updated_at` enabled=O: `CREATE TRIGGER google_calendar_connections_set_updated_at BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `google_calendar_connections_owner_read`

### `google_calendar_event_mappings`

- **Primary key** `google_calendar_event_mappings_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `google_calendar_event_mappings_user_session_key`: `UNIQUE (user_id, session_id)` validated=t
- **Check** `google_calendar_event_mappings_attempts_range`: `CHECK (((attempt_count >= 0) AND (attempt_count <= 10)))` validated=t
- **Check** `google_calendar_event_mappings_calendar_id_length`: `CHECK (((char_length(btrim(calendar_id)) >= 1) AND (char_length(btrim(calendar_id)) <= 200)))` validated=t
- **Check** `google_calendar_event_mappings_error_length`: `CHECK (((last_error_category IS NULL) OR ((char_length(last_error_category) >= 1) AND (char_length(last_error_category) <= 40))))` validated=t
- **Check** `google_calendar_event_mappings_event_id_length`: `CHECK (((google_event_id IS NULL) OR ((char_length(google_event_id) >= 1) AND (char_length(google_event_id) <= 1024))))` validated=t
- **Check** `google_calendar_event_mappings_status_allowed`: `CHECK ((status = ANY (ARRAY['pending'::text, 'synced'::text, 'out_of_sync'::text, 'failed'::text, 'deleted'::text])))` validated=t
- **Check** `google_calendar_event_mappings_synced_event`: `CHECK (((status <> 'synced'::text) OR (google_event_id IS NOT NULL)))` validated=t
- **Foreign key** `google_calendar_event_mappings_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES discussion_sessions(id) ON DELETE CASCADE` validated=t
- **Foreign key** `google_calendar_event_mappings_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `google_calendar_event_mappings_due_idx` (btree, unique=f): `CREATE INDEX google_calendar_event_mappings_due_idx ON public.google_calendar_event_mappings USING btree (status, next_attempt_at)`
- **Index** `google_calendar_event_mappings_event_key` (btree, unique=t): `CREATE UNIQUE INDEX google_calendar_event_mappings_event_key ON public.google_calendar_event_mappings USING btree (user_id, calendar_id, google_event_id) WHERE (google_event_id IS NOT NULL)`
- **Index** `google_calendar_event_mappings_pkey` (btree, unique=t): `CREATE UNIQUE INDEX google_calendar_event_mappings_pkey ON public.google_calendar_event_mappings USING btree (id)`
- **Index** `google_calendar_event_mappings_user_idx` (btree, unique=f): `CREATE INDEX google_calendar_event_mappings_user_idx ON public.google_calendar_event_mappings USING btree (user_id, updated_at DESC)`
- **Index** `google_calendar_event_mappings_user_session_key` (btree, unique=t): `CREATE UNIQUE INDEX google_calendar_event_mappings_user_session_key ON public.google_calendar_event_mappings USING btree (user_id, session_id)`
- **Trigger** `google_calendar_event_mappings_set_updated_at` enabled=O: `CREATE TRIGGER google_calendar_event_mappings_set_updated_at BEFORE UPDATE ON public.google_calendar_event_mappings FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `google_calendar_event_mappings_owner_read`

### `leave_lecturer_outcomes`

- **Primary key** `leave_lecturer_outcomes_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `leave_lecturer_outcomes_note_check`: `CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 2000))))` validated=t
- **Check** `leave_lecturer_outcomes_outcome_check`: `CHECK ((outcome = ANY (ARRAY['approved'::text, 'rejected'::text, 'awaiting'::text])))` validated=t
- **Foreign key** `leave_lecturer_outcomes_recorded_by_fkey`: `FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `leave_lecturer_outcomes_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES leave_requests(id) ON DELETE CASCADE` validated=t
- **Index** `leave_lecturer_outcomes_pkey` (btree, unique=t): `CREATE UNIQUE INDEX leave_lecturer_outcomes_pkey ON public.leave_lecturer_outcomes USING btree (id)`
- **Index** `leave_lecturer_outcomes_request_idx` (btree, unique=f): `CREATE INDEX leave_lecturer_outcomes_request_idx ON public.leave_lecturer_outcomes USING btree (request_id, created_at)`
- **RLS policies:** 1 â€” `leave_lecturer_outcomes_select`

### `leave_request_evidence`

- **Primary key** `leave_request_evidence_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `leave_request_evidence_path_key`: `UNIQUE (storage_path)` validated=t
- **Check** `leave_request_evidence_filename_length`: `CHECK (((char_length(btrim(original_filename)) >= 1) AND (char_length(btrim(original_filename)) <= 200)))` validated=t
- **Check** `leave_request_evidence_mime_allowed`: `CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text])))` validated=t
- **Check** `leave_request_evidence_path_length`: `CHECK (((char_length(storage_path) >= 10) AND (char_length(storage_path) <= 500)))` validated=t
- **Check** `leave_request_evidence_removal_pair`: `CHECK (((removed_at IS NULL) = (removed_by IS NULL)))` validated=t
- **Check** `leave_request_evidence_size_range`: `CHECK (((file_size >= 1) AND (file_size <= 10485760)))` validated=t
- **Check** `leave_request_evidence_sort_range`: `CHECK (((sort_order >= 0) AND (sort_order <= 50)))` validated=t
- **Foreign key** `leave_request_evidence_removed_by_fkey`: `FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `leave_request_evidence_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES leave_requests(id) ON DELETE CASCADE` validated=t
- **Foreign key** `leave_request_evidence_uploaded_by_fkey`: `FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `leave_request_evidence_path_key` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_evidence_path_key ON public.leave_request_evidence USING btree (storage_path)`
- **Index** `leave_request_evidence_pkey` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_evidence_pkey ON public.leave_request_evidence USING btree (id)`
- **Index** `leave_request_evidence_request_idx` (btree, unique=f): `CREATE INDEX leave_request_evidence_request_idx ON public.leave_request_evidence USING btree (request_id, sort_order) WHERE (removed_at IS NULL)`
- **RLS policies:** 1 â€” `leave_request_evidence_select`

### `leave_request_forwarding_items`

- **Primary key** `leave_request_forwarding_items_pkey`: `PRIMARY KEY (forwarding_id, request_id)` validated=t
- **Unique** `leave_request_forwarding_items_request_key`: `UNIQUE (request_id)` validated=t
- **Check** `leave_request_forwarding_items_date_order`: `CHECK ((leave_end_date >= leave_start_date))` validated=t
- **Check** `leave_request_forwarding_items_name_length`: `CHECK (((char_length(btrim(student_display_name)) >= 1) AND (char_length(btrim(student_display_name)) <= 120)))` validated=t
- **Foreign key** `leave_request_forwarding_items_forwarding_id_fkey`: `FOREIGN KEY (forwarding_id) REFERENCES leave_request_forwardings(id) ON DELETE CASCADE` validated=t
- **Foreign key** `leave_request_forwarding_items_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES leave_requests(id) ON DELETE RESTRICT` validated=t
- **Index** `leave_request_forwarding_items_forwarding_idx` (btree, unique=f): `CREATE INDEX leave_request_forwarding_items_forwarding_idx ON public.leave_request_forwarding_items USING btree (forwarding_id)`
- **Index** `leave_request_forwarding_items_pkey` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_forwarding_items_pkey ON public.leave_request_forwarding_items USING btree (forwarding_id, request_id)`
- **Index** `leave_request_forwarding_items_request_key` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_forwarding_items_request_key ON public.leave_request_forwarding_items USING btree (request_id)`
- **RLS policies:** 1 â€” `leave_request_forwarding_items_select`

### `leave_request_forwardings`

- **Primary key** `leave_request_forwardings_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `leave_request_forwardings_idempotency_key`: `UNIQUE (idempotency_key)` validated=t
- **Unique** `leave_request_forwardings_reference_key`: `UNIQUE (reference)` validated=t
- **Check** `leave_request_forwardings_count_range`: `CHECK (((request_count >= 1) AND (request_count <= 200)))` validated=t
- **Check** `leave_request_forwardings_email_length`: `CHECK (((recipient_email IS NULL) OR ((char_length(btrim(recipient_email)) >= 3) AND (char_length(btrim(recipient_email)) <= 254))))` validated=t
- **Check** `leave_request_forwardings_format_allowed`: `CHECK ((report_format = ANY (ARRAY['summary'::text, 'complete'::text])))` validated=t
- **Check** `leave_request_forwardings_idempotency_length`: `CHECK (((char_length(idempotency_key) >= 8) AND (char_length(idempotency_key) <= 200)))` validated=t
- **Check** `leave_request_forwardings_recipient_length`: `CHECK (((char_length(btrim(recipient_name)) >= 1) AND (char_length(btrim(recipient_name)) <= 160)))` validated=t
- **Check** `leave_request_forwardings_reference_format`: `CHECK ((reference ~ '^LF-[0-9A-F]{12}$'::text))` validated=t
- **Check** `leave_request_forwardings_report_ref_length`: `CHECK (((char_length(btrim(report_reference)) >= 1) AND (char_length(btrim(report_reference)) <= 160)))` validated=t
- **Foreign key** `leave_request_forwardings_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `leave_request_forwardings_forwarded_by_fkey`: `FOREIGN KEY (forwarded_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Index** `leave_request_forwardings_class_idx` (btree, unique=f): `CREATE INDEX leave_request_forwardings_class_idx ON public.leave_request_forwardings USING btree (class_id, created_at DESC)`
- **Index** `leave_request_forwardings_idempotency_key` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_forwardings_idempotency_key ON public.leave_request_forwardings USING btree (idempotency_key)`
- **Index** `leave_request_forwardings_pkey` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_forwardings_pkey ON public.leave_request_forwardings USING btree (id)`
- **Index** `leave_request_forwardings_reference_key` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_forwardings_reference_key ON public.leave_request_forwardings USING btree (reference)`
- **RLS policies:** 1 â€” `leave_request_forwardings_select`

### `leave_request_history`

- **Primary key** `leave_request_history_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `leave_request_history_action_allowed`: `CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'submitted'::text, 'revision_requested'::text, 'resubmitted'::text, 'approved'::text, 'rejected'::text, 'forwarded'::text, 'cancelled'::text, 'evidence_added'::text, 'evidence_removed'::text, 'ocr_recorded'::text])))` validated=t
- **Check** `leave_request_history_metadata_object`: `CHECK ((jsonb_typeof(metadata) = 'object'::text))` validated=t
- **Check** `leave_request_history_note_length`: `CHECK (((note IS NULL) OR ((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 2000))))` validated=t
- **Foreign key** `leave_request_history_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `leave_request_history_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES leave_requests(id) ON DELETE CASCADE` validated=t
- **Index** `leave_request_history_pkey` (btree, unique=t): `CREATE UNIQUE INDEX leave_request_history_pkey ON public.leave_request_history USING btree (id)`
- **Index** `leave_request_history_request_idx` (btree, unique=f): `CREATE INDEX leave_request_history_request_idx ON public.leave_request_history USING btree (request_id, created_at)`
- **RLS policies:** 1 â€” `leave_request_history_select`

### `leave_requests`

- **Primary key** `leave_requests_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `leave_requests_reference_key`: `UNIQUE (reference)` validated=t
- **Check** `leave_requests_cancel_consistency`: `CHECK (((status = 'cancelled'::text) = (cancelled_at IS NOT NULL)))` validated=t
- **Check** `leave_requests_cancel_not_forwarded`: `CHECK (((cancelled_at IS NULL) OR (forwarded_at IS NULL)))` validated=t
- **Check** `leave_requests_cancellation_note_length`: `CHECK (((cancellation_note IS NULL) OR ((char_length(btrim(cancellation_note)) >= 1) AND (char_length(btrim(cancellation_note)) <= 2000))))` validated=t
- **Check** `leave_requests_complete`: `CHECK (((status = ANY (ARRAY['draft'::text, 'cancelled'::text])) OR ((leave_start_date IS NOT NULL) AND (leave_end_date IS NOT NULL) AND (reason_category IS NOT NULL) AND (explanation IS NOT NULL) AND (submitted_at IS NOT NULL))))` validated=t
- **Check** `leave_requests_date_order`: `CHECK (((leave_start_date IS NULL) OR (leave_end_date IS NULL) OR (leave_end_date >= leave_start_date)))` validated=t
- **Check** `leave_requests_draft_never_submitted`: `CHECK (((status <> 'draft'::text) OR ((submitted_at IS NULL) AND (forwarded_at IS NULL))))` validated=t
- **Check** `leave_requests_explanation_length`: `CHECK (((explanation IS NULL) OR ((char_length(btrim(explanation)) >= 10) AND (char_length(btrim(explanation)) <= 4000))))` validated=t
- **Check** `leave_requests_field_sources_object`: `CHECK ((jsonb_typeof(field_sources) = 'object'::text))` validated=t
- **Check** `leave_requests_forwarded_at_consistency`: `CHECK (((status = 'forwarded'::text) = (forwarded_at IS NOT NULL)))` validated=t
- **Check** `leave_requests_ocr_result_object`: `CHECK (((ocr_result IS NULL) OR (jsonb_typeof(ocr_result) = 'object'::text)))` validated=t
- **Check** `leave_requests_ocr_status_allowed`: `CHECK ((ocr_status = ANY (ARRAY['not_run'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'unsupported'::text])))` validated=t
- **Check** `leave_requests_range_days`: `CHECK (((leave_start_date IS NULL) OR (leave_end_date IS NULL) OR ((leave_end_date - leave_start_date) <= 365)))` validated=t
- **Check** `leave_requests_reason_allowed`: `CHECK (((reason_category IS NULL) OR (reason_category = ANY (ARRAY['illness'::text, 'family_matter'::text, 'other'::text]))))` validated=t
- **Check** `leave_requests_reference_format`: `CHECK ((reference ~ '^LR-[0-9A-F]{12}$'::text))` validated=t
- **Check** `leave_requests_status_allowed`: `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'revision_requested'::text, 'forwarded'::text, 'cancelled'::text])))` validated=t
- **Check** `leave_requests_subject_count`: `CHECK ((cardinality(subject_ids) <= 20))` validated=t
- **Foreign key** `leave_requests_cancelled_by_fkey`: `FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `leave_requests_class_id_fkey`: `FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE` validated=t
- **Foreign key** `leave_requests_student_id_fkey`: `FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `leave_requests_action_center_idx` (btree, unique=f): `CREATE INDEX leave_requests_action_center_idx ON public.leave_requests USING btree (class_id, submitted_at DESC) WHERE (status = ANY (ARRAY['submitted'::text, 'revision_requested'::text]))`
- **Index** `leave_requests_class_status_idx` (btree, unique=f): `CREATE INDEX leave_requests_class_status_idx ON public.leave_requests USING btree (class_id, status, created_at DESC)`
- **Index** `leave_requests_forwardable_idx` (btree, unique=f): `CREATE INDEX leave_requests_forwardable_idx ON public.leave_requests USING btree (class_id, submitted_at DESC) WHERE (status = 'submitted'::text)`
- **Index** `leave_requests_leave_date_idx` (btree, unique=f): `CREATE INDEX leave_requests_leave_date_idx ON public.leave_requests USING btree (class_id, leave_start_date) WHERE (status <> 'draft'::text)`
- **Index** `leave_requests_pkey` (btree, unique=t): `CREATE UNIQUE INDEX leave_requests_pkey ON public.leave_requests USING btree (id)`
- **Index** `leave_requests_reference_key` (btree, unique=t): `CREATE UNIQUE INDEX leave_requests_reference_key ON public.leave_requests USING btree (reference)`
- **Index** `leave_requests_student_idx` (btree, unique=f): `CREATE INDEX leave_requests_student_idx ON public.leave_requests USING btree (student_id, created_at DESC)`
- **Trigger** `leave_requests_set_updated_at` enabled=O: `CREATE TRIGGER leave_requests_set_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **Trigger** `leave_requests_subjects_in_class` enabled=O: `CREATE TRIGGER leave_requests_subjects_in_class BEFORE INSERT OR UPDATE OF subject_ids, class_id ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION ensure_leave_subjects_in_class()`
- **RLS policies:** 1 â€” `leave_requests_select`

### `notification_deliveries`

- **Primary key** `notification_deliveries_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `notification_deliveries_dedupe`: `UNIQUE (user_id, assignment_id, reminder_type, deadline_at)` validated=t
- **Check** `notification_deliveries_attempts_range`: `CHECK (((attempt_count >= 0) AND (attempt_count <= 10)))` validated=t
- **Check** `notification_deliveries_error_length`: `CHECK (((last_error_category IS NULL) OR ((char_length(last_error_category) >= 1) AND (char_length(last_error_category) <= 40))))` validated=t
- **Check** `notification_deliveries_status_allowed`: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))` validated=t
- **Check** `notification_deliveries_type_allowed`: `CHECK ((reminder_type = ANY (ARRAY['24h'::text, '3h'::text])))` validated=t
- **Foreign key** `notification_deliveries_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Foreign key** `notification_deliveries_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `notification_deliveries_dedupe` (btree, unique=t): `CREATE UNIQUE INDEX notification_deliveries_dedupe ON public.notification_deliveries USING btree (user_id, assignment_id, reminder_type, deadline_at)`
- **Index** `notification_deliveries_due_idx` (btree, unique=f): `CREATE INDEX notification_deliveries_due_idx ON public.notification_deliveries USING btree (status, next_attempt_at)`
- **Index** `notification_deliveries_pkey` (btree, unique=t): `CREATE UNIQUE INDEX notification_deliveries_pkey ON public.notification_deliveries USING btree (id)`
- **Index** `notification_deliveries_retention_idx` (btree, unique=f): `CREATE INDEX notification_deliveries_retention_idx ON public.notification_deliveries USING btree (updated_at) WHERE (status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text]))`
- **Index** `notification_deliveries_user_recent_idx` (btree, unique=f): `CREATE INDEX notification_deliveries_user_recent_idx ON public.notification_deliveries USING btree (user_id, created_at DESC)`
- **Trigger** `notification_deliveries_set_updated_at` enabled=O: `CREATE TRIGGER notification_deliveries_set_updated_at BEFORE UPDATE ON public.notification_deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `notification_deliveries_owner_read`

### `notification_events`

- **Primary key** `notification_events_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `notification_events_dedupe_key`: `UNIQUE (dedupe_key)` validated=t
- **Check** `notification_events_attempts_range`: `CHECK (((attempt_count >= 0) AND (attempt_count <= 10)))` validated=t
- **Check** `notification_events_dedupe_key_length`: `CHECK (((char_length(dedupe_key) >= 8) AND (char_length(dedupe_key) <= 200)))` validated=t
- **Check** `notification_events_error_length`: `CHECK (((last_error_category IS NULL) OR ((char_length(last_error_category) >= 1) AND (char_length(last_error_category) <= 40))))` validated=t
- **Check** `notification_events_kind_allowed`: `CHECK ((kind = ANY (ARRAY['class_application_approved'::text, 'class_application_rejected'::text, 'class_admin_assigned'::text, 'class_invitation'::text, 'assignment_approved'::text, 'assignment_rejected'::text, 'submission_received'::text, 'moderation_required'::text, 'session_updated'::text, 'session_cancelled'::text, 'session_rsvp'::text, 'leave_request_submitted'::text, 'leave_request_revision_requested'::text, 'leave_request_forwarded'::text, 'leave_request_approved'::text, 'leave_request_rejected'::text, 'leave_request_cancelled'::text, 'verification_submitted'::text, 'verification_approved'::text, 'verification_rejected'::text, 'verification_revision_requested'::text, 'class_admin_revoked'::text, 'class_assignment_published'::text, 'assignment_report_reviewed'::text])))` validated=t
- **Check** `notification_events_payload_object`: `CHECK ((jsonb_typeof(payload) = 'object'::text))` validated=t
- **Check** `notification_events_payload_size`: `CHECK ((pg_column_size(payload) <= 4096))` validated=t
- **Check** `notification_events_status_allowed`: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))` validated=t
- **Foreign key** `notification_events_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `notification_events_dedupe_key` (btree, unique=t): `CREATE UNIQUE INDEX notification_events_dedupe_key ON public.notification_events USING btree (dedupe_key)`
- **Index** `notification_events_due_idx` (btree, unique=f): `CREATE INDEX notification_events_due_idx ON public.notification_events USING btree (status, next_attempt_at)`
- **Index** `notification_events_pkey` (btree, unique=t): `CREATE UNIQUE INDEX notification_events_pkey ON public.notification_events USING btree (id)`
- **Index** `notification_events_user_recent_idx` (btree, unique=f): `CREATE INDEX notification_events_user_recent_idx ON public.notification_events USING btree (user_id, created_at DESC)`
- **Index** `notification_events_user_unread_idx` (btree, unique=f): `CREATE INDEX notification_events_user_unread_idx ON public.notification_events USING btree (user_id, created_at DESC) WHERE (read_at IS NULL)`
- **Trigger** `notification_events_set_updated_at` enabled=O: `CREATE TRIGGER notification_events_set_updated_at BEFORE UPDATE ON public.notification_events FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 1 â€” `notification_events_read`

### `notification_preferences`

- **Primary key** `notification_preferences_pkey`: `PRIMARY KEY (user_id)` validated=t
- **Check** `notification_preferences_timezone_length`: `CHECK (((char_length(btrim(timezone)) >= 1) AND (char_length(btrim(timezone)) <= 64)))` validated=t
- **Foreign key** `notification_preferences_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `notification_preferences_pkey` (btree, unique=t): `CREATE UNIQUE INDEX notification_preferences_pkey ON public.notification_preferences USING btree (user_id)`
- **Trigger** `notification_preferences_set_updated_at` enabled=O: `CREATE TRIGGER notification_preferences_set_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 3 â€” `notification_preferences_owner_insert`, `notification_preferences_owner_read`, `notification_preferences_owner_update`

### `personal_calendar_events`

- **Primary key** `personal_calendar_events_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `personal_calendar_events_description_length`: `CHECK (((description IS NULL) OR ((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 2000))))` validated=t
- **Check** `personal_calendar_events_location_length`: `CHECK (((location IS NULL) OR ((char_length(btrim(location)) >= 1) AND (char_length(btrim(location)) <= 200))))` validated=t
- **Check** `personal_calendar_events_status_allowed`: `CHECK ((status = ANY (ARRAY['published'::text, 'cancelled'::text, 'archived'::text])))` validated=t
- **Check** `personal_calendar_events_time_zone_length`: `CHECK (((char_length(btrim(time_zone)) >= 1) AND (char_length(btrim(time_zone)) <= 64)))` validated=t
- **Check** `personal_calendar_events_title_length`: `CHECK (((char_length(btrim(title)) >= 2) AND (char_length(btrim(title)) <= 160)))` validated=t
- **Check** `personal_calendar_events_window`: `CHECK (((ends_at > starts_at) AND (ends_at <= (starts_at + '30 days'::interval))))` validated=t
- **Foreign key** `personal_calendar_events_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `personal_calendar_events_pkey` (btree, unique=t): `CREATE UNIQUE INDEX personal_calendar_events_pkey ON public.personal_calendar_events USING btree (id)`
- **Index** `personal_calendar_events_user_live_idx` (btree, unique=f): `CREATE INDEX personal_calendar_events_user_live_idx ON public.personal_calendar_events USING btree (user_id, starts_at) WHERE (status <> 'archived'::text)`
- **Index** `personal_calendar_events_user_start_idx` (btree, unique=f): `CREATE INDEX personal_calendar_events_user_start_idx ON public.personal_calendar_events USING btree (user_id, starts_at)`
- **Trigger** `personal_calendar_events_set_updated_at` enabled=O: `CREATE TRIGGER personal_calendar_events_set_updated_at BEFORE UPDATE ON public.personal_calendar_events FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 4 â€” `personal_calendar_events_owner_delete`, `personal_calendar_events_owner_insert`, `personal_calendar_events_owner_read`, `personal_calendar_events_owner_update`

### `platform_admins`

- **Primary key** `platform_admins_pkey`: `PRIMARY KEY (user_id)` validated=t
- **Foreign key** `platform_admins_granted_by_fkey`: `FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL` validated=t
- **Foreign key** `platform_admins_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `platform_admins_pkey` (btree, unique=t): `CREATE UNIQUE INDEX platform_admins_pkey ON public.platform_admins USING btree (user_id)`
- **RLS policies:** 0

### `profiles`

- **Primary key** `profiles_pkey`: `PRIMARY KEY (id)` validated=t
- **Check** `profiles_avatar_url_https`: `CHECK (((avatar_url IS NULL) OR (avatar_url ~~ 'https://%'::text)))` validated=t
- **Check** `profiles_bio_length`: `CHECK (((bio IS NULL) OR ((char_length(btrim(bio)) >= 1) AND (char_length(btrim(bio)) <= 280))))` validated=t
- **Check** `profiles_declared_class_length`: `CHECK (((declared_class_name IS NULL) OR ((char_length(btrim(declared_class_name)) >= 1) AND (char_length(btrim(declared_class_name)) <= 60))))` validated=t
- **Check** `profiles_declared_position_allowed`: `CHECK ((declared_position = ANY (ARRAY['student'::text, 'class_representative'::text])))` validated=t
- **Check** `profiles_display_name_length`: `CHECK (((char_length(btrim(display_name)) >= 1) AND (char_length(btrim(display_name)) <= 80)))` validated=t
- **Check** `profiles_full_name_length`: `CHECK (((full_name IS NULL) OR ((char_length(btrim(full_name)) >= 2) AND (char_length(btrim(full_name)) <= 80))))` validated=t
- **Check** `profiles_nim_format`: `CHECK (((nim IS NULL) OR (nim ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'::text)))` validated=t
- **Check** `profiles_university_length`: `CHECK (((university IS NULL) OR ((char_length(btrim(university)) >= 2) AND (char_length(btrim(university)) <= 120))))` validated=t
- **Foreign key** `profiles_id_fkey`: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `profiles_nim_unique` (btree, unique=t): `CREATE UNIQUE INDEX profiles_nim_unique ON public.profiles USING btree (lower(btrim(nim))) WHERE (nim IS NOT NULL)`
- **Index** `profiles_pkey` (btree, unique=t): `CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)`
- **Trigger** `profiles_set_updated_at` enabled=O: `CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 2 â€” `profiles_owner_update`, `profiles_public_read`

### `push_subscriptions`

- **Primary key** `push_subscriptions_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `push_subscriptions_endpoint_key`: `UNIQUE (endpoint)` validated=t
- **Check** `push_subscriptions_auth_length`: `CHECK (((char_length(auth) >= 8) AND (char_length(auth) <= 100)))` validated=t
- **Check** `push_subscriptions_device_label_length`: `CHECK (((device_label IS NULL) OR ((char_length(btrim(device_label)) >= 1) AND (char_length(btrim(device_label)) <= 60))))` validated=t
- **Check** `push_subscriptions_endpoint_https`: `CHECK ((endpoint ~~ 'https://%'::text))` validated=t
- **Check** `push_subscriptions_endpoint_length`: `CHECK (((char_length(endpoint) >= 12) AND (char_length(endpoint) <= 2048)))` validated=t
- **Check** `push_subscriptions_p256dh_length`: `CHECK (((char_length(p256dh) >= 16) AND (char_length(p256dh) <= 200)))` validated=t
- **Foreign key** `push_subscriptions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `push_subscriptions_endpoint_key` (btree, unique=t): `CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions USING btree (endpoint)`
- **Index** `push_subscriptions_pkey` (btree, unique=t): `CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id)`
- **Index** `push_subscriptions_user_active_idx` (btree, unique=f): `CREATE INDEX push_subscriptions_user_active_idx ON public.push_subscriptions USING btree (user_id) WHERE (disabled_at IS NULL)`
- **Trigger** `push_subscriptions_set_updated_at` enabled=O: `CREATE TRIGGER push_subscriptions_set_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
- **RLS policies:** 4 â€” `push_subscriptions_owner_delete`, `push_subscriptions_owner_insert`, `push_subscriptions_owner_read`, `push_subscriptions_owner_update`

### `rate_limits`

- **Primary key** `rate_limits_pkey`: `PRIMARY KEY (key)` validated=t
- **Check** `rate_limits_hits_positive`: `CHECK ((hits > 0))` validated=t
- **Check** `rate_limits_key_length`: `CHECK (((char_length(key) >= 8) AND (char_length(key) <= 200)))` validated=t
- **Index** `rate_limits_pkey` (btree, unique=t): `CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (key)`
- **RLS policies:** 0

### `saved_assignments`

- **Primary key** `saved_assignments_pkey`: `PRIMARY KEY (id)` validated=t
- **Unique** `saved_assignments_user_assignment_key`: `UNIQUE (user_id, assignment_id)` validated=t
- **Foreign key** `saved_assignments_assignment_id_fkey`: `FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE` validated=t
- **Foreign key** `saved_assignments_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` validated=t
- **Index** `saved_assignments_assignment_idx` (btree, unique=f): `CREATE INDEX saved_assignments_assignment_idx ON public.saved_assignments USING btree (assignment_id)`
- **Index** `saved_assignments_pkey` (btree, unique=t): `CREATE UNIQUE INDEX saved_assignments_pkey ON public.saved_assignments USING btree (id)`
- **Index** `saved_assignments_user_assignment_key` (btree, unique=t): `CREATE UNIQUE INDEX saved_assignments_user_assignment_key ON public.saved_assignments USING btree (user_id, assignment_id)`
- **Index** `saved_assignments_user_recent_idx` (btree, unique=f): `CREATE INDEX saved_assignments_user_recent_idx ON public.saved_assignments USING btree (user_id, created_at DESC)`
- **RLS policies:** 3 â€” `saved_assignments_owner_delete`, `saved_assignments_owner_insert`, `saved_assignments_owner_read`
