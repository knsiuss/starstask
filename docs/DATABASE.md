# Database — StarsTask

Schema source of truth: `supabase/migrations/`.

| File                                                | Contents                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `20261029000100_core_schema.sql`                    | Extensions, tables, constraints, indexes, triggers                           |
| `20261029000200_functions.sql`                      | Profile provisioning, course upsert, listing RPC, path parser, rate limiter  |
| `20261029000300_rls.sql`                            | RLS enablement, policies, column-level grants                                |
| `20261029000400_storage.sql`                        | Private bucket and `storage.objects` policies                                |
| `20261029000500_push_notifications.sql`             | Push tables, constraints, indexes, `updated_at` triggers                     |
| `20261029000600_push_functions.sql`                 | Subscription upsert, audience query, claim/complete RPCs                     |
| `20261029000700_push_rls.sql`                       | RLS and column grants for the four push tables                               |
| `20261029000800_function_grants.sql`                | Revokes `anon` EXECUTE that Supabase default privileges add to new functions |
| `20261029000900_classes.sql`                        | Class, application, membership, invitation, review, audit tables             |
| `20261029001000_notification_events.sql`            | Durable notification event queue                                             |
| `20261029001100_class_functions.sql`                | Class workflow and moderation `SECURITY DEFINER` functions                   |
| `20261029001200_class_rls.sql`                      | RLS, column grants, and reviewer storage policy for class data               |
| `20261029001300_class_queries.sql`                  | Reviewer read policy and `list_classes` discovery RPC                        |
| `20261029001400_class_public_assignment_filter.sql` | `list_assignments` class filter and `class_id` result                        |
| `20261029001500_platform_moderation_restore.sql`    | Restore is platform-admin only; class admins may hide, not restore           |
| `20261029002000_push_subscription_privileges.sql`   | `user_id` read grant and caller-scoped endpoint delete RPC                   |
| `20261029002200_leave_requests.sql`                 | Leave request, evidence, history, and forwarding tables                      |
| `20261029002300_leave_functions.sql`                | Leave workflow `SECURITY DEFINER` functions and notification kinds           |
| `20261029002400_leave_rls.sql`                      | RLS, `SELECT`-only policies, and the private `leave-evidence` bucket         |
| `20261029002500_leave_grants.sql`                   | Column-level `SELECT` grants and `EXECUTE` on the leave workflow RPCs        |
| `20261029002600_class_verification.sql`             | Representative verification tables, functions, RLS, and private bucket       |
| `20261029003000_platform_admin_queries.sql`         | Platform admin user/class directories and overview counters                  |
| `20261030090000_absence_cancellation.sql`           | Absence statuses (`draft`/`submitted`/`forwarded`/`cancelled`), cancellation |
| `20261030180000_assignment_authenticated_read.sql`  | Authenticated-only assignment, attachment, storage, and listing access       |

Apply with `supabase db push` (remote) or `supabase db reset` (local). `seed.sql` is loaded
only by `db reset` / `supabase start`; `db push` never applies it.

## 1. Entity relationships

```
auth.users 1 ──── 1 profiles
auth.users 1 ──── * assignments * ──── 1 courses
assignments 1 ─── * assignment_attachments
auth.users 1 ──── * push_subscriptions
auth.users 1 ──── 1 notification_preferences
auth.users 1 ──── * saved_assignments * ──── 1 assignments
auth.users 1 ──── * notification_deliveries * ──── 1 assignments
rate_limits (standalone counter table, no client access)

auth.users 1 ──── * class_applications * ──── 0..1 classes
auth.users 1 ──── * class_members * ──── 1 classes
auth.users 1 ──── * class_admins * ──── 1 classes
auth.users 1 ──── * class_invitations * ──── 1 classes
classes 1 ─── * assignments (nullable class_id)
assignments 1 ─── * assignment_reviews
classes 1 ─── * audit_logs

auth.users 1 ─── * class_verification_requests * ──── 1 classes
class_verification_requests 1 ─── * class_verification_evidence
class_verification_requests 1 ─── * class_verification_reviews
```

A verified request stores exactly one `class_id`; approval grants `class_admins` for that
class only. The profile position column is a claim and no relationship grants access.

`assignments.user_id` references `auth.users(id) ON DELETE CASCADE`. Deleting a user
removes their assignments and, by cascade, their attachment rows. The push tables also
cascade from `auth.users`, and `saved_assignments` / `notification_deliveries` cascade
from `assignments`.

## 2. Tables

### `profiles`

| Column                     | Type          | Notes                                                                             |
| -------------------------- | ------------- | --------------------------------------------------------------------------------- |
| `id`                       | uuid PK       | References `auth.users(id)` ON DELETE CASCADE                                     |
| `display_name`             | text NOT NULL | Public display name; 1–80 chars. Onboarding writes the nickname here              |
| `avatar_url`               | text NULL     | `https://` only                                                                   |
| `full_name`                | text NULL     | Legal name. Private: **no column grant** to `anon`/`authenticated`                |
| `nim`                      | text NULL     | Student ID, stored as text so leading zeros survive. Private: **no column grant** |
| `university`               | text NULL     | Free-text, 2–120 chars. Collected, not verified                                   |
| `declared_class_name`      | text NULL     | The class text the student typed; kept even when nothing matched                  |
| `onboarded_at`             | timestamptz   | Set once by `update_my_profile()`. NULL means onboarding is incomplete            |
| `declared_position`        | text NOT NULL | Default `'student'`; documentation of intent, never an authorization input        |
| `created_at`, `updated_at` | timestamptz   | `updated_at` maintained by trigger                                                |

Created by the `on_auth_user_created` trigger, not by the client.

`full_name` and `nim` are the sensitive pair. They exist on the row but are not granted to
any client role, so PostgREST cannot select them; the owner reads and writes them only
through the `SECURITY DEFINER` RPCs in section 4. `onboarded_at` is granted to
`authenticated` because the workspace gate reads it with the user's own session. Only these
account-related grants decide visibility, so the public `profiles` policy can stay open.

### `courses`

| Column            | Type           | Notes                                     |
| ----------------- | -------------- | ----------------------------------------- |
| `id`              | uuid PK        | `gen_random_uuid()`                       |
| `name`            | text NOT NULL  | 2–120 chars                               |
| `code`            | text NULL      | ≤20 chars                                 |
| `department`      | text NULL      | 2–120 chars                               |
| `normalized_name` | text generated | `lower(btrim(name))`, unique              |
| `normalized_code` | text generated | `nullif(lower(btrim(code)), '')`, indexed |
| `created_at`      | timestamptz    |                                           |

The unique index on `normalized_name` makes `insert ... on conflict` safe under concurrent
submissions.

### `assignments`

| Column                     | Type               | Notes                                         |
| -------------------------- | ------------------ | --------------------------------------------- |
| `id`                       | uuid PK            |                                               |
| `title`                    | text NOT NULL      | 3–200 chars                                   |
| `description`              | text NOT NULL      | 10–20,000 chars                               |
| `course_id`                | uuid NOT NULL      | `ON DELETE RESTRICT`                          |
| `user_id`                  | uuid NOT NULL      | `ON DELETE CASCADE`; immutable after insert   |
| `lecturer_name`            | text NULL          | ≤120                                          |
| `semester`                 | text NULL          | ≤20                                           |
| `academic_year`            | text NULL          | `^\d{4}/\d{4}$`                               |
| `assignment_type`          | text NULL          | One of seven values                           |
| `deadline`                 | timestamptz NULL   | Precise instant, rendered in Asia/Jakarta     |
| `tags`                     | text[] NOT NULL    | ≤10 entries                                   |
| `reference_urls`           | jsonb NOT NULL     | Array, ≤10 entries                            |
| `status`                   | text NOT NULL      | `published` \| `pending`, default `published` |
| `search_vector`            | tsvector generated | `title` weight A, `description` weight B      |
| `created_at`, `updated_at` | timestamptz        |                                               |

Triggers:

- `assignments_set_updated_at` — sets `updated_at = now()` on every UPDATE.
- `assignments_owner_immutable` — raises `42501` if `user_id` changes.

### `assignment_attachments`

| Column              | Type                 | Notes                                      |
| ------------------- | -------------------- | ------------------------------------------ |
| `id`                | uuid PK              |                                            |
| `assignment_id`     | uuid NOT NULL        | `ON DELETE CASCADE`                        |
| `storage_path`      | text NOT NULL UNIQUE | `{owner_id}/{assignment_id}/{uuid}-{name}` |
| `original_filename` | text NOT NULL        | 1–255 chars                                |
| `mime_type`         | text NOT NULL        | Six allowed values                         |
| `file_size`         | bigint NOT NULL      | 1 – 10,485,760                             |
| `created_at`        | timestamptz          |                                            |

### `rate_limits`

Internal fixed-window counters: `key` (PK), `window_started_at`, `hits`. No client grants;
only `consume_rate_limit()` touches it. A 1% chance cleanup deletes rows older than a day.

### `push_subscriptions`

| Column                     | Type          | Notes                                            |
| -------------------------- | ------------- | ------------------------------------------------ |
| `id`                       | uuid PK       | `gen_random_uuid()`                              |
| `user_id`                  | uuid NOT NULL | `ON DELETE CASCADE`; immutable in practice       |
| `endpoint`                 | text NOT NULL | Unique, `https://` only, 12–2048 chars           |
| `p256dh`, `auth`           | text NOT NULL | Browser key material, 16–200 / 8–100 chars       |
| `device_label`             | text NULL     | 1–60 chars when present                          |
| `created_at`, `updated_at` | timestamptz   | `updated_at` maintained by trigger               |
| `last_success_at`          | timestamptz   | Set by the scheduler after a successful send     |
| `disabled_at`              | timestamptz   | Set on `404`/`410`; inactive rows are not loaded |

The endpoint is unique across all users. `register_push_subscription` never transfers
ownership: a re-registration by another account returns `null`.

### `notification_preferences`

| Column                     | Type        | Notes                                       |
| -------------------------- | ----------- | ------------------------------------------- |
| `user_id`                  | uuid PK     | `ON DELETE CASCADE`                         |
| `push_enabled`             | boolean     | Default `false` (no reminders until opt-in) |
| `reminder_24h`             | boolean     | Default `true`                              |
| `reminder_3h`              | boolean     | Default `true`                              |
| `timezone`                 | text        | Default `Asia/Jakarta`, 1–64 chars          |
| `created_at`, `updated_at` | timestamptz |                                             |

A missing row is treated as "never opted in" by the data layer, so no null branch is
needed in the UI. The first write inserts and later writes update: `authenticated` holds
`UPDATE` on the four preference columns only, so an upsert (whose `ON CONFLICT DO UPDATE`
also assigns `user_id`) is rejected and ownership stays immutable.

### `saved_assignments`

| Column          | Type          | Notes               |
| --------------- | ------------- | ------------------- |
| `id`            | uuid PK       | `gen_random_uuid()` |
| `user_id`       | uuid NOT NULL | `ON DELETE CASCADE` |
| `assignment_id` | uuid NOT NULL | `ON DELETE CASCADE` |
| `created_at`    | timestamptz   |                     |

Unique on `(user_id, assignment_id)`. Insert policy requires that the assignment is
published **or** owned by the caller, so a save cannot reveal a pending assignment.

### `notification_deliveries`

| Column                     | Type          | Notes                                                 |
| -------------------------- | ------------- | ----------------------------------------------------- |
| `id`                       | uuid PK       | `gen_random_uuid()`                                   |
| `user_id`                  | uuid NOT NULL | `ON DELETE CASCADE`                                   |
| `assignment_id`            | uuid NOT NULL | `ON DELETE CASCADE`                                   |
| `reminder_type`            | text          | `24h` or `3h`                                         |
| `deadline_at`              | timestamptz   | Deadline this reminder belongs to                     |
| `scheduled_for`            | timestamptz   | Deadline minus the reminder offset                    |
| `status`                   | text          | `pending`, `processing`, `sent`, `failed`, `skipped`  |
| `attempt_count`            | integer       | 0–10; incremented by the claim RPC                    |
| `next_attempt_at`          | timestamptz   | Retry gate                                            |
| `last_error_category`      | text NULL     | Short label (`expired`, `transient`, …), never a body |
| `created_at`, `updated_at` | timestamptz   |                                                       |
| `delivered_at`             | timestamptz   | Set when the row becomes `sent`                       |

Unique on `(user_id, assignment_id, reminder_type, deadline_at)`. This is the durable
dedupe key: repeated runs are idempotent, and a changed deadline produces a new logical
reminder while the old row is skipped as stale.

There is no automatic retention job. Delete terminal rows only after their deadline is
well in the past, otherwise a still-open window could enqueue the reminder again.

### Class workflow tables

| Table                          | Purpose                                             | Notable constraints                                                       |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `platform_admins`              | Trusted operators                                   | No client grants; write with the service role only                        |
| `classes`                      | Approved, active or archived class                  | Unique slug; slug format, status, length, and join-policy checks          |
| `class_applications`           | User request to create a class                      | Decision consistency check; partial unique open application per applicant |
| `class_application_reviews`    | Append-only decision history                        | `decision in ('approved','rejected')`                                     |
| `class_members`                | Membership                                          | PK `(class_id, user_id)`; join source check                               |
| `class_admins`                 | Admin subset of members                             | FK to `class_members` with cascade; no admin without membership           |
| `class_invitations`            | Hashed invitation links                             | Unique 64-char `token_hash`; expiry and usage checks                      |
| `class_invitation_acceptances` | Who accepted which link                             | Unique `(invitation_id, user_id)`                                         |
| `assignment_reviews`           | Submission, approval, rejection, moderation history | Reason required for rejected/unpublished/archived                         |
| `audit_logs`                   | Append-only audit trail                             | Action and entity type format checks; metadata must be an object          |

`classes.join_policy` is `'invitation'` (default) or `'open'`. Only an `'open'` class may be
joined automatically when a student types its name; the default keeps every existing class
invitation-only, so nothing changes until an operator opts a class in:

```sql
update public.classes
set
  join_policy = 'open'
where
  slug = 'if-24-01';
```

No admin UI sets this yet — it is a documented manual step. `class_members.joined_via` gains
`name_match` alongside `invitation`, `admin_assignment`, and `platform_assignment`, so a
membership created by onboarding is distinguishable from an invited one.

`assignments` gains `class_id`, `reviewed_by`, `reviewed_at`, `rejection_reason`,
`published_at`, and `revision`. The status check includes `draft`, `pending_review`,
`published`, `rejected`, `unpublished`, and `archived`, plus the legacy `pending`.

A class admin's own post is stored as `draft` by `submit_class_assignment` and moved to
`published` by `publish_class_assignment` once its attachments exist. `delete_class`
archives the class's published assignments before deleting the row, because
`assignments.class_id` is `ON DELETE SET NULL`. `notification_events.kind` gains
`class_assignment_published`.

### Class verification tables

Full behaviour is documented in [CLASS_VERIFICATION.md](CLASS_VERIFICATION.md); this is
the schema view.

| Table                         | Purpose                                     | Notable constraints                                                                                    |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `class_verification_requests` | One representative claim for one class      | Status/decision consistency; no self-review; partial unique live request per student and class         |
| `class_verification_evidence` | Private proof metadata for a request        | Unique `storage_path`; PDF/JPG/PNG only; 1–10,485,760 bytes; soft delete via `removed_at`/`removed_by` |
| `class_verification_reviews`  | Append-only submission and decision history | Action allowlist; status allowlist; metadata must be an object                                         |

`class_verification_requests.status` is `pending`, `needs_revision`, `verified`, or
`rejected`. A `pending` row with `submitted_at IS NULL` is a draft; it is not visible to
reviewers and cannot be reviewed. `not_requested` is the absence of a row, not a stored
value. A verified request names exactly one class, and only approval creates the
`class_admins` row for it.

`notification_events.kind` gains `verification_submitted`, `verification_approved`,
`verification_rejected`, `verification_revision_requested`, and `class_admin_revoked`.

### Discussion session tables

Full behaviour is documented in [SESSIONS.md](SESSIONS.md); this is the schema view.

| Table                            | Purpose                                 | Notable constraints                                                                                                                                                                              |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `discussion_sessions`            | One row per scheduled session           | `ends_at > starts_at` and ≤24h; `registration_deadline ≤ starts_at`; `online` needs `meeting_url` (`https://`), `in_person` needs `location`; `capacity` 1–1000; status/cancelled_at consistency |
| `discussion_session_rsvps`       | One RSVP per user per session           | Unique `(session_id, user_id)`; `status in ('going','maybe','not_going')`                                                                                                                        |
| `discussion_session_checkins`    | One attendance row per user per session | Unique `(session_id, user_id)`; `status` in four values; `method in ('geo','manual')`; a `geo` row requires coordinates, accuracy, and distance                                                  |
| `discussion_session_reminders`   | Durable reminder ledger                 | Unique `(user_id, session_id, reminder_type, starts_at)`; attempt and status checks                                                                                                              |
| `google_calendar_connections`    | One Google Calendar connection per user | PK `user_id`; ciphertext-only token columns; `status in ('connected','revoked','error')`                                                                                                         |
| `google_calendar_event_mappings` | Session → Google event mapping per user | Unique `(user_id, session_id)`; partial unique `(user_id, calendar_id, google_event_id)`                                                                                                         |

`notification_preferences` gains `session_reminder_24h` and `session_reminder_3h`, both
`not null default true` and both user-writable. `notification_events.kind` gains
`session_updated`, `session_cancelled`, and `session_rsvp`.

`discussion_sessions` also carries `checkin_latitude`, `checkin_longitude`, and
`checkin_radius_m` (25–1,000 m, default 150). The point is optional; without it an
in-person session cannot accept a location check-in.

### Trust-loop tables

Full behaviour is documented in [TRUST_LOOP.md](TRUST_LOOP.md); this is the schema view.

| Table                  | Purpose                         | Notable constraints                                                                                                                        |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `assignment_reports`   | A reader says a brief is wrong  | `reason` in five values; `status` in `open`/`resolved`/`dismissed`; one open report per `(assignment_id, reporter_id)`; note 5–2,000 chars |
| `assignment_revisions` | Append-only snapshot of a brief | `change_kind` in `created`/`updated`/`moderated`; written only by the `assignments` trigger                                                |

`assignment_reports.class_id` is denormalised from the assignment so the review queue and
RLS can filter by class without a join. `report_assignment()` keeps it in sync and rejects
an assignment with no class.

## 3. Indexes

| Index                                               | Purpose                                    |
| --------------------------------------------------- | ------------------------------------------ |
| `assignments_public_recent_idx` (partial)           | Newest-first public listing                |
| `assignments_deadline_idx` (partial)                | Deadline sort, published only              |
| `assignments_course_idx`                            | Course filter                              |
| `assignments_owner_recent_idx`                      | My Assignments                             |
| `assignments_tags_idx` (GIN)                        | Tag filter                                 |
| `assignments_search_idx` (GIN)                      | Full-text search                           |
| `courses_normalized_name_key` (unique)              | Deduplicated course upsert                 |
| `courses_normalized_code_idx`                       | Course code lookup                         |
| `assignment_attachments_assignment_idx`             | Attachment embeds and counts               |
| `push_subscriptions_user_active_idx`                | Active devices per user                    |
| `saved_assignments_user_recent_idx`                 | Saved list, newest first                   |
| `saved_assignments_assignment_idx`                  | Audience lookup by assignment              |
| `notification_deliveries_due_idx`                   | Claim query (`status, next_attempt_at`)    |
| `notification_deliveries_user_recent_idx`           | Per-user delivery history                  |
| `classes_slug_key` (unique)                         | Public class URL lookup                    |
| `classes_active_recent_idx` (partial)               | Public class discovery                     |
| `class_applications_open_applicant_key`             | Duplicate open application prevention      |
| `assignments_class_idx`                             | Class assignment lists                     |
| `assignments_review_queue_idx` (partial)            | Pending review queue per class             |
| `class_invitations_token_hash_key`                  | Constant-time invitation lookup            |
| `class_verification_requests_student_idx`           | A student's own requests, newest first     |
| `class_verification_requests_queue_idx` (partial)   | Submitted review queue by status           |
| `class_verification_requests_active_key` (unique)   | One live request per student and class     |
| `class_verification_evidence_request_idx` (partial) | Active evidence counts                     |
| `class_verification_reviews_request_idx`            | Request history, oldest first              |
| `audit_logs_class_idx` / `_created_idx`             | Class and platform audit views             |
| `discussion_sessions_class_idx`                     | Class-scoped lists                         |
| `discussion_sessions_upcoming_idx` (partial)        | Global upcoming list                       |
| `discussion_sessions_public_upcoming_idx` (partial) | Public session discovery                   |
| `discussion_sessions_organizer_idx`                 | "Sessions I organise"                      |
| `discussion_sessions_assignment_idx` (partial)      | Sessions linked to an assignment           |
| `discussion_session_rsvps_session_idx`              | Attendance counts and participant list     |
| `discussion_session_rsvps_user_idx`                 | "My RSVPs"                                 |
| `discussion_session_reminders_due_idx`              | Reminder claim (`status, next_attempt_at`) |
| `discussion_session_checkins_session_idx`           | Attendance list per session and status     |
| `discussion_session_checkins_user_idx`              | A student's attendance history             |
| `google_calendar_event_mappings_due_idx`            | Calendar sync queue                        |
| `google_calendar_event_mappings_event_key` (unique) | One mapping per Google event               |
| `assignment_reports_queue_idx`                      | Open-report queue, newest first            |
| `assignment_reports_class_idx`                      | Reports per class and status               |
| `assignment_reports_one_open_idx` (unique, partial) | One open report per reader per assignment  |
| `assignment_revisions_assignment_idx`               | Revision history, newest first             |

## 4. Functions

| Function                                                                                                                                  | Security                                             | Purpose                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `set_updated_at()`                                                                                                                        | invoker                                              | Generic `updated_at` trigger                                                                                  |
| `handle_new_user()`                                                                                                                       | definer, `search_path = ''`                          | Provision a profile from Google metadata (display name + legal name); idempotent via `on conflict do nothing` |
| `prevent_assignment_owner_change()`                                                                                                       | invoker                                              | Reject `user_id` changes                                                                                      |
| `create_or_get_course(p_name, p_code, p_department)`                                                                                      | definer, authenticated only                          | Insert-or-select with normalized-name conflict handling                                                       |
| `list_assignments(...)`                                                                                                                   | invoker                                              | Filtered, sorted, paginated public listing with `total_count`                                                 |
| `assignment_id_from_object_path(text)`                                                                                                    | invoker                                              | Extract the assignment UUID from a storage key                                                                |
| `consume_rate_limit(key, limit, window)`                                                                                                  | definer                                              | Atomic fixed-window counter                                                                                   |
| `register_push_subscription(endpoint, p256dh, auth, label)`                                                                               | definer, authenticated                               | Upsert the caller's subscription; returns `null` if the endpoint belongs to someone else                      |
| `list_reminder_audience(assignment_ids)`                                                                                                  | definer, service_role only                           | Opted-in owners and savers with an active device                                                              |
| `claim_notification_deliveries(now, limit)`                                                                                               | definer, service_role only                           | Requeue stale `processing`, claim due rows with `FOR UPDATE SKIP LOCKED`                                      |
| `complete_notification_delivery(id, status, error, next)`                                                                                 | definer, service_role only                           | Finish a claimed row; `pending` is a bounded requeue                                                          |
| `is_platform_admin()` / `is_class_member(id)` / `is_class_admin(id)` / `can_manage_class(id)`                                             | definer, authenticated                               | Role predicates used by RLS policies and functions                                                            |
| `apply_for_class(...)` / `revise_class_application` / `withdraw_class_application`                                                        | definer, authenticated                               | Applicant-only application workflow                                                                           |
| `decide_class_application(id, decision, note, grant_class_admin)`                                                                         | definer, platform admin                              | Creates the class; optionally grants the class admin role                                                     |
| `create_class_invitation` / `revoke_class_invitation` / `accept_class_invitation`                                                         | definer, class manager / authenticated               | Invitation lifecycle and membership grant                                                                     |
| `assign_class_admin` / `revoke_class_admin` / `remove_class_member` / `set_class_status` / `update_class_metadata` / `delete_class`       | definer, scoped                                      | Role, membership, and class lifecycle management; delete archives published assignments first                 |
| `submit_class_assignment` / `revise_class_assignment`                                                                                     | definer, class member                                | Creates `pending_review`, or `draft` for a class admin's own post; revision increments and requeues           |
| `review_class_assignment`                                                                                                                 | definer, class manager                               | Approve (publish) or reject with reason; blocks self-review                                                   |
| `publish_class_assignment`                                                                                                                | definer, author and class manager                    | Publishes the caller's own class post and queues `class_assignment_published` for every member                |
| `moderate_assignment` / `remove_assignment_attachment`                                                                                    | definer, class/platform admin                        | Unpublish, archive, restore, and sensitive-file removal                                                       |
| `list_classes(search, semester, limit, offset)`                                                                                           | definer, anon + auth                                 | Public active-class discovery with member count                                                               |
| `record_audit` / `enqueue_notification_event`                                                                                             | definer, internal only                               | Append audit entries and queue opted-in push events                                                           |
| `can_organize_class_sessions(id)` / `can_view_session(id)` / `session_class_id(id)`                                                       | definer, authenticated (anon for `can_view_session`) | Session permission predicates used by RLS and the write functions                                             |
| `create_discussion_session(...)` / `update_discussion_session(...)`                                                                       | definer, class manager                               | Create and edit a session; rejects non-scheduled edits and settles side effects on a time change              |
| `set_discussion_session_status(id, status)`                                                                                               | definer, class manager                               | Cancel, complete, or reopen; notifies participants and reconciles reminders and calendar mappings             |
| `rsvp_discussion_session(id, status)` / `cancel_session_rsvp(id)`                                                                         | definer, authenticated                               | Upsert or delete the caller's own RSVP; `FOR UPDATE` capacity check                                           |
| `session_attendance(id)`                                                                                                                  | definer, authenticated                               | Counts plus the caller's own status, one row even with no RSVPs                                               |
| `set_discussion_session_checkin_location(id, lat, lon, radius)` / `clear_discussion_session_checkin_location(id)`                         | definer, class organizer                             | Save or remove the room point; `in_person` and `scheduled` only                                               |
| `check_in_discussion_session(id, lat, lon, accuracy)`                                                                                     | definer, authenticated                               | Enforces window, accuracy ≤100 m, radius, and membership; idempotent per user                                 |
| `record_discussion_session_checkin(id, user, status, note)` / `review_discussion_session_checkin(id, checkin, status, note)`              | definer, class organizer                             | Manual row without coordinates, or a status override; target must be a class member                           |
| `distance_meters(lat1, lon1, lat2, lon2)`                                                                                                 | invoker, internal only                               | Haversine metres; not granted to clients                                                                      |
| `list_discussion_sessions(...)`                                                                                                           | definer, anon + auth                                 | Visibility-filtered list with class, organiser, and attendance counts                                         |
| `list_session_reminder_audience(ids)` / `claim_session_reminders(now, limit)` / `complete_session_reminder(...)`                          | definer, service_role only                           | Session reminder scheduler                                                                                    |
| `normalize_class_key(value)`                                                                                                              | invoker                                              | The single definition of "same class name": lowercase, strip non-alphanumerics                                |
| `get_my_profile()`                                                                                                                        | definer, authenticated only                          | The owner's own profile, including the private `full_name` and `nim`                                          |
| `update_my_profile(name, nickname, nim, university, class)`                                                                               | definer, authenticated only                          | Validates and persists the onboarding form; sets `onboarded_at` once                                          |
| `set_my_avatar_url(url)`                                                                                                                  | definer, authenticated only                          | Points the caller's profile at an uploaded avatar; `https://` only                                            |
| `join_class_by_name(name)`                                                                                                                | definer, authenticated only                          | Normalize → match one active class → ordinary membership, or a clear `no_match`/`ambiguous`/policy result     |
| `get_my_declared_position()` / `set_my_declared_position(position)`                                                                       | definer, authenticated                               | Read or record the caller's own position claim; writes no role                                                |
| `begin_class_verification(...)` / `revise_class_verification(...)` / `submit_class_verification(...)` / `discard_class_verification(...)` | definer, owner                                       | Draft, edit, submit, and discard workflow                                                                     |
| `add_class_verification_evidence(...)` / `remove_class_verification_evidence(id)`                                                         | definer, owner                                       | Register or soft-delete private proof; the storage prefix is enforced                                         |
| `decide_class_verification(id, decision, note)` / `revoke_verified_class_admin(id, note)`                                                 | definer, platform admin                              | Record a decision and create the scoped class admin row; revoke that grant                                    |
| `can_view_class_verification(id)` / `can_edit_class_verification(id)` / `verification_request_id_from_object_path(name)`                  | definer / stable                                     | Visibility, editability, and storage-key predicates                                                           |
| `report_assignment(assignment_id, reason, note)`                                                                                          | definer, authenticated                               | Upserts the caller's one open report; rejects drafts, deleted rows, and classless assignments                 |
| `review_assignment_report(report_id, status, note)`                                                                                       | definer, class or platform admin                     | Resolves or dismisses an open report; refuses a second review and writes an audit entry                       |
| `record_assignment_revision()`                                                                                                            | definer, trigger only                                | Snapshots title, description, deadline, status, and course on every meaningful assignment change              |

`handle_new_user` reads only `full_name`, `name`, `avatar_url`, `picture`, and the email
local-part as a last-resort display name. It stores no tokens. Non-`https` avatars are
dropped rather than failing signup, and the legal name is truncated to 80 characters.

`join_class_by_name` returns a discriminated JSON object: `{status: "joined" | "already_member" | "blocked_by_policy"}`
with `classId`/`slug`/`name`, `{status: "ambiguous", candidates: [...]}`, or
`{status: "no_match"}`. It only ever inserts into `class_members`; it never touches
`class_admins`, so matching cannot grant a role. See [`PROFILE_ONBOARDING.md`](./PROFILE_ONBOARDING.md).

## 5. RLS matrix

| Table                            | anon SELECT                                        | auth SELECT                                | INSERT                           | UPDATE                                      | DELETE     |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------ | -------------------------------- | ------------------------------------------- | ---------- |
| `profiles`                       | any row, columns `id, display_name, avatar_url`    | same, plus `onboarded_at`                  | none                             | own row, columns `display_name, avatar_url` | none       |
| `courses`                        | all rows                                           | all rows                                   | none (RPC only)                  | none                                        | none       |
| `assignments`                    | `status = 'published'`                             | published **or** own                       | own `user_id` only               | own only                                    | own only   |
| `assignment_attachments`         | parent published                                   | parent published or own                    | own parent + own path prefix     | none                                        | own parent |
| `push_subscriptions`             | none                                               | own row (no endpoint/keys)                 | own `user_id` only               | own row, `device_label` only                | own row    |
| `notification_preferences`       | none                                               | own row                                    | own `user_id` only               | own row, preference columns only            | none       |
| `saved_assignments`              | none                                               | own rows                                   | own row for a visible assignment | none                                        | own rows   |
| `notification_deliveries`        | none                                               | own rows (read-only)                       | none                             | none                                        | none       |
| `rate_limits`                    | none                                               | none                                       | none                             | none                                        | none       |
| `platform_admins`                | none                                               | none                                       | none                             | none                                        | none       |
| `classes`                        | active only                                        | active, own, or managed                    | none (RPC only)                  | none (RPC only)                             | none       |
| `class_applications`             | none                                               | own or platform admin                      | none (RPC only)                  | none (RPC only)                             | none       |
| `class_members`                  | none                                               | own class or platform admin                | none (RPC only)                  | none                                        | none (RPC) |
| `class_admins`                   | none                                               | own class or platform admin                | none (RPC only)                  | none                                        | none (RPC) |
| `class_invitations`              | none                                               | managers, no `token_hash`                  | none (RPC only)                  | none                                        | none (RPC) |
| `assignment_reviews`             | none                                               | submitter, reviewer, admin                 | none (RPC only)                  | none                                        | none       |
| `audit_logs`                     | none                                               | class or platform admin                    | none                             | none                                        | none       |
| `notification_events`            | none                                               | own rows                                   | none (RPC only)                  | none                                        | none       |
| `class_verification_requests`    | none                                               | own, or platform admin for submitted rows  | none (RPC only)                  | none (RPC only)                             | none (RPC) |
| `class_verification_evidence`    | none                                               | same as the parent request                 | none (RPC only)                  | none (RPC only)                             | none (RPC) |
| `class_verification_reviews`     | none                                               | same as the parent request, no `actor_id`  | none (RPC only)                  | none (RPC only)                             | none       |
| `discussion_sessions`            | `visibility = 'public'`, no `agenda`/`meeting_url` | `can_view_session(id)`                     | none (RPC only)                  | none (RPC only)                             | none       |
| `discussion_session_rsvps`       | none                                               | own row, or class manager                  | none (RPC only)                  | none (RPC only)                             | none (RPC) |
| `discussion_session_checkins`    | none                                               | own row, or session organizer              | none (RPC only)                  | none (RPC only)                             | none       |
| `discussion_session_reminders`   | none                                               | none                                       | none (RPC only)                  | none (RPC only)                             | none       |
| `google_calendar_connections`    | none                                               | own row, non-secret columns                | none (RPC/service only)          | none                                        | none       |
| `google_calendar_event_mappings` | none                                               | own rows                                   | none (service only)              | none                                        | none       |
| `assignment_reports`             | none                                               | own reports, or a class the caller manages | none (RPC only)                  | none (RPC only)                             | none       |
| `assignment_revisions`           | none                                               | author, class managers, platform admins    | none (trigger only)              | none                                        | none       |

Column-level grants back this up: `assignments` INSERT does not include `status`, and
UPDATE does not include `user_id` or `status`. A client cannot publish into a moderation
state or transfer ownership even before the trigger fires. For push tables, `endpoint`,
`p256dh`, and `auth` are not granted for SELECT, and `notification_deliveries` has no
INSERT/UPDATE/DELETE grant at all.

`profiles.full_name` and `profiles.nim` have no SELECT or UPDATE grant for any client role,
so the open read policy never exposes the legal name or student ID. The owner reaches them
only through `get_my_profile` / `update_my_profile`.

The session tables follow the same rule: no INSERT/UPDATE/DELETE grant for `anon` or
`authenticated`, and `google_calendar_connections` grants SELECT on the non-secret columns
only, so `access_token_ciphertext` and `refresh_token_ciphertext` never reach a client.

## 6. Storage

Bucket: `assignment-attachments`, `public = false`, 10 MiB limit, six allowed MIME types.

Object key: `{auth.uid()}/{assignment_id}/{uuid}-{sanitized_filename}`.

| Operation | Policy                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------- |
| SELECT    | owner prefix, **or** the assignment referenced by the key is published, **or** a reviewer of that class |
| INSERT    | owner prefix **and** the caller owns that assignment                                                    |
| DELETE    | owner prefix only (sensitive-file removal uses the service role)                                        |

The delete policy deliberately omits the assignment lookup so cleanup still works after
the row is deleted.

Downloads use `createSignedUrl(path, 900)`. The signed URL is only issued if the policy
lets the current role read the object.

### `leave-evidence`

Bucket: `leave-evidence`, `public = false`, 10 MiB limit, `application/pdf`,
`image/jpeg`, `image/png`.

Object key: `{auth.uid()}/{leave_request_id}/{uuid}-{sanitized_filename}`.

| Operation | Policy                                                                       |
| --------- | ---------------------------------------------------------------------------- |
| SELECT    | owner prefix, **or** the caller may review the request referenced by the key |
| INSERT    | owner prefix **and** the caller owns that request and it is still editable   |
| DELETE    | owner prefix only                                                            |

Signed URLs last **300 seconds** — shorter than assignment attachments, because a
leave document is medical evidence. The full leave schema, its statuses, and its
export behaviour are documented in [`LEAVE_REQUESTS.md`](./LEAVE_REQUESTS.md).

### `verification-evidence`

Bucket: `verification-evidence`, `public = false`, 10 MiB limit, `application/pdf`,
`image/jpeg`, `image/png`.

Object key: `{auth.uid()}/{verification_request_id}/{uuid}-{sanitized_filename}`.

| Operation | Policy                                                                     |
| --------- | -------------------------------------------------------------------------- |
| SELECT    | owner prefix, **or** the caller may view the request referenced by the key |
| INSERT    | owner prefix **and** the caller owns that request and it is still editable |
| DELETE    | owner prefix only                                                          |

Signed URLs last **300 seconds**; evidence is personal proof and a leaked link should
stop working quickly. The request id in the key is resolved through the database, not
trusted from the caller. Full behaviour: [CLASS_VERIFICATION.md](CLASS_VERIFICATION.md).

### `avatars`

Bucket: `avatars`, `public = true`, 2 MiB limit, `image/png` and `image/jpeg`.

Object key: `{auth.uid()}/{uuid}.{ext}`.

| Operation | Policy            |
| --------- | ----------------- |
| SELECT    | any object        |
| INSERT    | owner prefix only |
| UPDATE    | owner prefix only |
| DELETE    | owner prefix only |

The bucket is public because an avatar is already public contributor metadata and an `<img>`
should not need a signed-URL round trip. Writes stay owner-scoped, and the server validates
the bytes by signature before uploading, so a browser cannot store an arbitrary file under
someone else's prefix.

## 7. Regenerating types

```bash
supabase start
pnpm db:types
```

`apps/web/src/types/database.ts` is hand-maintained today because no project is connected.
After regeneration, re-run `pnpm typecheck` and confirm the embedded relationship shapes
still match `src/lib/db/assignments.ts`.

## 8. Verification queries

Run in the SQL editor against a disposable project:

```sql
-- RLS is on everywhere that matters
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

-- Anonymous visitors must see zero pending rows
set role anon;
select count(*) from public.assignments where status = 'pending';  -- expect 0
reset role;

-- Clients have no SELECT grant on push endpoints or key material
select has_column_privilege('authenticated', 'public.push_subscriptions', 'endpoint', 'select');
-- expect false

-- Verification tables are read-only to clients, and the reviewer identity is hidden
select has_table_privilege('authenticated', 'public.class_verification_requests', 'insert');
-- expect false
select has_column_privilege('authenticated', 'public.class_verification_requests', 'reviewed_by', 'select');
-- expect false

-- Only submitted requests reach a platform admin; a draft stays with its owner
select count(*) from public.class_verification_requests where submitted_at is null;
-- as a platform admin who does not own the draft: expect 0
```

The automated equivalent is `pnpm test:integration` (see `tests/integration/rls.test.ts`),
which includes the four push tables and has not been executed in this environment.
