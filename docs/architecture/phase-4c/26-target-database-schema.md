# 26 — Target Database Schema (All 27 Domains)

> **Status:** DRAFT / PROPOSED. **Naming:** `snake_case`; `id uuid PK DEFAULT gen_random_uuid()`; junction composite PKs; `created_at/updated_at timestamptz NOT NULL DEFAULT now()` + `set_updated_at()` trigger; `status text CHECK (...)`; FK suffix `_id`; tenant column always `university_id uuid NOT NULL` unless GLOBAL. **Typing:** `uuid` PKs/FKs; `text` with length CHECKs; `numeric` for scores (never float); `timestamptz` for instants, `date` + IANA `timezone text` for schedule wall-times; `jsonb` only for audit snapshots; `text[]` for tags; `tsvector` generated for search. **Ownership:** one owner domain per table; cross-domain writes via RPC. **Decision values:** NEW / KEEP / MODIFY / MERGE / SPLIT / DEPRECATE. **Tenant classes:** GLOBAL / TENANT_OWNED / TENANT_DERIVED / CROSS_TENANT_REFERENCE / PLATFORM_CONTROLLED (see `23`).

---

## A. Global identity — `profiles`

- **Domain:** A
- **Purpose:** Global display identity (one row per `auth.users`).
- **Ownership:** Global identity.
- **Tenant classification:** GLOBAL.
- **Lifecycle:** active on signup (trigger `handle_new_user()`); never deleted except global cascade.
- **Existing equivalent:** `profiles` (VERIFIED `20261029000100` + onboarding `20261029002700` + bio `20261029003100`).
- **Decision:** MODIFY.

| Column                     | Type        | Null     | Default / CHECK                                                 |
| -------------------------- | ----------- | -------- | --------------------------------------------------------------- |
| `id`                       | uuid PK     | NOT NULL | → `auth.users(id)` CASCADE                                      |
| `display_name`             | text        | NOT NULL | CHECK 1–80                                                      |
| `avatar_url`               | text        | NULL     | CHECK https                                                     |
| `bio`                      | text        | NULL     | `20261029003100`                                                |
| `full_name`                | text        | NULL     | CHECK 2–80; never granted to anon/authenticated (VERIFIED rule) |
| `nickname`                 | text        | NULL     | —                                                               |
| `onboarded_at`             | timestamptz | NULL     | set by `update_my_profile()` only                               |
| `created_at`, `updated_at` | timestamptz | NOT NULL | `now()`                                                         |

- **Relationships:** `auth.users 1:1 profiles`; `profiles 1:N student_identities`.
- **Indexes:** PK only (+ trigger).
- **Security:** self RLS; `full_name`/`nim` via SECURITY DEFINER only (VERIFIED pattern).
- **Operational notes:** DEPRECATE `university`/`nim`/`declared_class_name` free-text columns after `student_identities` backfill (see `11`, `29`).

## B. University registry — `universities`

- **Domain:** B | **Purpose:** Central registry + tenant root. | **Ownership:** Platform. | **Tenant classification:** PLATFORM_CONTROLLED.
- **Lifecycle:** registered → pending → active → suspended → inactive (CONFIRMED).
- **Existing equivalent:** none (VERIFIED ABSENT).
- **Decision:** NEW (RECOMMENDED single-table, ADR-002 PROPOSED).

| Column                     | Type        | Null     | Default / CHECK                         |
| -------------------------- | ----------- | -------- | --------------------------------------- |
| `id`                       | uuid PK     | NOT NULL | `gen_random_uuid()`                     |
| `name`                     | text        | NOT NULL | length CHECK                            |
| `short_code`               | text        | NOT NULL | UNIQUE                                  |
| `status`                   | text        | NOT NULL | `registered` CHECK (5 lifecycle values) |
| `timezone`                 | text        | NOT NULL | IANA zone (RECOMMENDED)                 |
| `locale`                   | text        | NULL     | —                                       |
| `created_by_admin`         | uuid        | NULL     | → `profiles(id)`                        |
| `created_at`, `updated_at` | timestamptz | NOT NULL | `now()`                                 |

- **Relationships:** root for all TENANT_OWNED/DERIVED tables.
- **Indexes:** UNIQUE `short_code`; `(status)` for active filtering.
- **Security:** writes via platform-admin RPCs only (CONFIRMED); suspended/inactive universities reads halted by RLS guard (RECOMMENDED).
- **Operational notes:** registry may include non-active universities (CONFIRMED); user creation forbidden (CONFIRMED).

## C. Academic organization — `academic_units`

- **Domain:** C | **Purpose:** Flexible org tree. | **Ownership:** University academic affairs. | **Tenant classification:** TENANT_OWNED.
- **Lifecycle:** draft → active → archived.
- **Existing equivalent:** none (`courses.department` free text only — VERIFIED).
- **Decision:** NEW (RECOMMENDED generalized model, ADR-003 APPROVED).

| Column                     | Type        | Null     | Default / CHECK                                |
| -------------------------- | ----------- | -------- | ---------------------------------------------- |
| `id`                       | uuid PK     | NOT NULL | —                                              |
| `university_id`            | uuid        | NOT NULL | → `universities(id)`                           |
| `parent_id`                | uuid        | NULL     | → `academic_units(id)`                         |
| `unit_type`                | text        | NOT NULL | seeds: faculty/department/program/branch/other |
| `name`                     | text        | NOT NULL | —                                              |
| `short_code`               | text        | NULL     | —                                              |
| `path`                     | text        | NULL     | materialized ancestry (RECOMMENDED)            |
| `status`                   | text        | NOT NULL | draft/active/archived                          |
| `created_at`, `updated_at` | timestamptz | NOT NULL | `now()`                                        |

- **Relationships:** `universities 1:N units`; `units N:1 parent`; `classes/unit_id`, `student_identities/unit_id` (nullable).
- **Indexes:** UNIQUE `(university_id, parent_id, short_code)` where not null; `path` prefix/trgm (RECOMMENDED, see `27`).
- **Security:** tenant RLS; class members read, admins write.
- **Operational notes:** replaces `courses.department` strings (MODIFY/MERGE in `29`).

## D. Academic period — `academic_periods`

- **Domain:** D | **Purpose:** Teaching-term container. | **Ownership:** University registrar. | **Tenant classification:** TENANT_OWNED.
- **Lifecycle:** planned → open → closed → archived (see `10`).
- **Existing equivalent:** none (free-text semester/year only — VERIFIED).
- **Decision:** NEW.

| Column                     | Type        | Null     | Default / CHECK               |
| -------------------------- | ----------- | -------- | ----------------------------- |
| `id`                       | uuid PK     | NOT NULL | —                             |
| `university_id`            | uuid        | NOT NULL | → `universities(id)`          |
| `name`                     | text        | NOT NULL | e.g. "Fall 2026 / Semester 1" |
| `code`                     | text        | NOT NULL | UNIQUE per university         |
| `start_date`               | date        | NOT NULL | —                             |
| `end_date`                 | date        | NOT NULL | CHECK end >= start            |
| `enrollment_open`          | bool        | NOT NULL | `false`                       |
| `status`                   | text        | NOT NULL | planned/open/closed/archived  |
| `created_at`, `updated_at` | timestamptz | NOT NULL | `now()`                       |

- **Relationships:** `course_offerings.academic_period_id`.
- **Indexes:** UNIQUE `(university_id, code)`; `(university_id, status)`.
- **Security:** tenant RLS.
- **Operational notes:** `date`-only (no instants); year-start months are data (`10` §10.5).

## E. Student identity — `student_identities`

- **Domain:** E | **Purpose:** Per-university academic persona. | **Ownership:** Student + university registrar. | **Tenant classification:** TENANT_OWNED.
- **Lifecycle:** pending → active → suspended → graduated (see `11`).
- **Existing equivalent:** `profiles.nim`/`profiles.university` free text (VERIFIED) + NIM unique `20261029003110`.
- **Decision:** NEW (absorbs free-text columns).

| Column                     | Type        | Null     | Default / CHECK                    |
| -------------------------- | ----------- | -------- | ---------------------------------- |
| `id`                       | uuid PK     | NOT NULL | —                                  |
| `user_id`                  | uuid        | NOT NULL | → `profiles(id)`                   |
| `university_id`            | uuid        | NOT NULL | → `universities(id)`               |
| `student_id_number`        | text        | NOT NULL | per-tenant unique                  |
| `entry_year`               | int         | NOT NULL | CONFIRMED fixed cohort             |
| `full_name_snapshot`       | text        | NOT NULL | academic legal-name snapshot       |
| `unit_id`                  | uuid        | NULL     | → `academic_units(id)`             |
| `status`                   | text        | NOT NULL | pending/active/suspended/graduated |
| `verified_by`              | uuid        | NULL     | → `profiles(id)`                   |
| `verified_at`              | timestamptz | NULL     | —                                  |
| `created_at`, `updated_at` | timestamptz | NOT NULL | `now()`                            |

- **Relationships:** `profiles 1:N student_identities`; `student_identities 1:N class_memberships/enrollments`.
- **Indexes:** UNIQUE `(university_id, student_id_number)` (RECOMMENDED per-tenant); `(user_id)`.
- **Security:** tenant RLS; `student_id_number` readable by self + class admins.
- **Operational notes:** Entry Year immutable post-activation (admin-only correction, audited).

## F. Class & membership — `classes`, `class_memberships`

- **Domain:** F | **Purpose:** Cohort workspace + home-class membership. | **Ownership:** Class admins. | **Tenant classification:** TENANT_OWNED.
- **Lifecycle:** draft → active → archived; membership add/remove audited.
- **Existing equivalent:** `classes` + `class_members` (VERIFIED `20261029000900`).
- **Decision:** MODIFY/MERGE (see `12`).

`classes` columns: `id uuid PK`, `university_id uuid NOT NULL →universities`, `unit_id uuid NULL →academic_units`, `home_code text NOT NULL` (IF-2024-A), `entry_year int`, `name text NOT NULL`, `description text NOT NULL`, `status text NOT NULL CHECK (draft,active,archived)`, `created_by uuid NULL →profiles`, `created_at`, `updated_at`; UNIQUE `(university_id, home_code)`; UNIQUE `(id, university_id)` (for composite FKs); keep `slug` as display hint UNIQUE `(university_id, slug)`.

`class_memberships` columns: `id uuid PK`, `class_id uuid NOT NULL →classes`, `university_id uuid NOT NULL`, `student_identity_id uuid NOT NULL →student_identities`, `is_home bool NOT NULL DEFAULT true`, `joined_via text NOT NULL CHECK (invitation,admin_assignment,platform_assignment,transfer)`, `joined_at timestamptz NOT NULL`, `left_at timestamptz NULL`, `transferred_from_class_id uuid NULL`, `created_at`; FK `(class_id, university_id) →classes(id, university_id)` (RECOMMENDED); partial unique one-active-home (see `27`).

- **Indexes:** `(class_id, left_at)`, `(student_identity_id, is_home) WHERE left_at IS NULL`.
- **Security:** member read; admin write; tenant RLS.
- **Operational notes:** `class_members.user_id` → `student_identity_id` bridge migration (see `29`); multiple-classes UNRESOLVED (`12` §12.5).

## G. Course catalog / offering / enrollment — `courses`, `course_offerings`, `enrollments`

- **Domain:** G | **Purpose:** Catalogue vs offering vs enrollment triad. | **Ownership:** Catalogue: platform; Offering: class admins; Enrollment: system (invite/admin). | **Tenant classification:** `courses` GLOBAL; offerings TENANT_OWNED; enrollments TENANT_DERIVED.
- **Lifecycle:** offering draft → open → closed; enrollment active → dropped/completed (see `13`).
- **Existing equivalent:** `courses` (VERIFIED) + `class_subjects` + `class_subject_members` (VERIFIED).
- **Decision:** KEEP `courses` / MERGE `class_subjects`→`course_offerings` / RENAME `class_subject_members`→`enrollments`.

`courses` columns: unchanged from existing (`id`, `name`, `code`, `department`-to-deprecate, `normalized_name`/`normalized_code` generated, timestamps) + `university_id uuid NULL` (catalogue scope UNRESOLVED — RECOMMENDED nullable until decided).
`course_offerings` columns: `id uuid PK`, `university_id uuid NOT NULL`, `class_id uuid NOT NULL →classes`, `course_id uuid NOT NULL →courses`, `academic_period_id uuid NOT NULL →academic_periods`, `lecturer_name text NULL` (display only), `status text NOT NULL CHECK (draft,open,closed)`, `created_at`, `updated_at`; UNIQUE `(university_id, class_id, course_id, academic_period_id)`; UNIQUE `(id, university_id)`.
`enrollments` columns: `id uuid PK`, `offering_id uuid NOT NULL`, `university_id uuid NOT NULL`, `student_identity_id uuid NOT NULL`, `source text NOT NULL CHECK (home_class,invite_token,admin_add)`, `status text NOT NULL CHECK (active,dropped,completed)`, `created_at`; FK `(offering_id, university_id) →course_offerings(id, university_id)` CASCADE; partial unique active `(offering_id, student_identity_id)`.

- **Indexes:** `(class_id)`, `(course_id)`, `(offering_id, status)` — see `27`.
- **Security:** home-class derived access (no row); retake rows explicit.
- **Operational notes:** catalogue scope decision gates the `university_id` NOT NULL flip.

## H. Course invitation — `course_invite_tokens` (+ `course_invite_acceptances`)

- **Domain:** H | **Purpose:** Secure course-specific enrollment links. | **Ownership:** Class admins. | **Tenant classification:** TENANT_OWNED (via offering).
- **Lifecycle:** active → revoked/expired/exhausted (see `14`).
- **Existing equivalent:** `class_invitations` (class-level, VERIFIED: SHA-256 hash, max_uses 1–500) — course-scoped is NEW.
- **Decision:** NEW.

`course_invite_tokens` columns: `id uuid PK`, `offering_id uuid NOT NULL →course_offerings`, `university_id uuid NOT NULL`, `token_hash text NOT NULL UNIQUE` (CHECK length 64), `created_by uuid NOT NULL →profiles`, `expires_at timestamptz NULL`, `max_uses int NULL CHECK >0`, `use_count int NOT NULL DEFAULT 0`, `status text NOT NULL CHECK (active,revoked,expired,exhausted)`, `created_at`, `revoked_at NULL`, `revoked_by NULL`.
`course_invite_acceptances` columns: `id uuid PK`, `token_id uuid NOT NULL →tokens`, `redeemed_by uuid NOT NULL`, `redeemed_at timestamptz NOT NULL`, `enrollment_id uuid NOT NULL →enrollments`; UNIQUE `(token_id, redeemed_by)`.

- **Indexes:** UNIQUE `token_hash` (redeem path); `(offering_id, created_at)`.
- **Security:** hash-only storage; redeem RPC single-use safe; any class admin may create (CONFIRMED).
- **Operational notes:** RECOMMENDED default 10 uses / 30-day expiry (PROPOSED, `14`).

## I. Class Admin RBAC — `class_admin_assignments`, `class_admin_permissions`

- **Domain:** I | **Purpose:** Class-scoped granular admin roles. | **Ownership:** Class admins (manage_admins) + platform. | **Tenant classification:** TENANT_OWNED.
- **Lifecycle:** assigned → revoked (soft, `revoked_at`).
- **Existing equivalent:** `class_admins (class_id, user_id, assigned_by, assigned_at)` VERIFIED `20261029000900` (no permission columns).
- **Decision:** SPLIT (see `15`).

`class_admin_assignments` columns: `id uuid PK`, `class_id uuid NOT NULL →classes`, `university_id uuid NOT NULL`, `student_identity_id uuid NOT NULL →student_identities`, `granted_by uuid NOT NULL →profiles`, `granted_at timestamptz NOT NULL`, `revoked_at NULL`, `revoked_by NULL`.
`class_admin_permissions` columns: `assignment_id uuid NOT NULL →assignments`, `permission_code text NOT NULL CHECK (manage_attendance, manage_assignments, manage_announcements, manage_grades, manage_admins, manage_schedule, manage_materials, manage_leave_review)`; PK `(assignment_id, permission_code)`.

- **Indexes:** `(class_id, revoked_at)`, partial last-admin count (see `27` trigger).
- **Security:** only `manage_admins`/platform grant; last-admin trigger; member-must-remain invariant preserved.
- **Operational notes:** `class_admins` flag-free today → permission rows are net-new (expand-contract from assign/revoke paths).

## J. Assignments — `assignments`, `assignment_attachments`, `assignment_completions`, `assignment_reviews`, `assignment_reports`, `assignment_revisions`, `saved_assignments`

- **Domain:** J | **Purpose:** Assignment brief archive + class-course linkage. | **Ownership:** Authors + class admins. | **Tenant classification:** CROSS_TENANT_REFERENCE (`course_id`), TENANT_OWNED via `university_id`/`offering_id`.
- **Lifecycle:** draft → published → archived; moderation via reviews.
- **Existing equivalent:** 7 tables VERIFIED (`20261029000100`, `20261029000900`, `20261029003610`, `20261031100000`).
- **Decision:** KEEP + MODIFY.

`assignments` columns: existing (see `16` §16.1) + `university_id uuid NULL →universities` (backfill), `offering_id uuid NULL →course_offerings` (class-course assignments). Keeps: `search_vector` GIN (VERIFIED).
`assignment_attachments` columns: existing + `university_id` backfill; storage path convention see `20`.
Others: unchanged (completions/reviews/reports/revisions/saved) + `university_id` via parents where derivable.

- **Indexes:** `deadline ASC NULLS LAST` (VERIFIED existing), GIN search, `(class_id, status)`.
- **Security:** class-scoped read + public filter + publish privilege (VERIFIED precedents).
- **Operational notes:** deadline/late/attempt policies UNRESOLVED (`16` §16.3) — do not spec enforcement until confirmed.

## K. Attendance — `attendance_meetings`, `attendance_records`, `attendance_corrections`, `attendance_verification_attempts`

- **Domain:** K | **Purpose:** Per-meeting, per-enrollment attendance + audit. | **Ownership:** Class admins (manage_attendance). | **Tenant classification:** TENANT_DERIVED (via offering).
- **Lifecycle:** scheduled → open → closed/cancelled; records present→corrected (append-only).
- **Existing equivalent:** `discussion_sessions` container + `discussion_session_checkins` + `attendance_verification_attempts` + `attendance_correction_audits` (all VERIFIED).
- **Decision:** NEW meetings / RENAME records+corrections (see `17`).

`attendance_meetings` columns: `id uuid PK`, `offering_id uuid NOT NULL →course_offerings`, `university_id uuid NOT NULL`, `scheduled_at timestamptz NOT NULL`, `status CHECK (scheduled,open,closed,cancelled)`, `location text`, `created_by uuid NOT NULL`, `created_at`, `updated_at`; FK `(offering_id, university_id)`.
`attendance_records` columns: `id uuid PK`, `meeting_id uuid NOT NULL →meetings`, `student_identity_id uuid NOT NULL`, `status CHECK (present,late,excused,sick,absent)` (VERIFIED `20261107000000`), `recorded_by uuid NOT NULL`, `recorded_at timestamptz NOT NULL`, `note text` (≤500, VERIFIED); UNIQUE `(meeting_id, student_identity_id)`.
`attendance_corrections` columns: `id uuid PK`, `record_id uuid NOT NULL`, `previous_status CHECK five values`, `new_status CHECK five values`, `reason text NOT NULL`, `corrected_by uuid NOT NULL`, `corrected_at`; append-only (REVOKE UPDATE/DELETE).
`attendance_verification_attempts`: KEEP (geo/identity audit, read via RPC only).

- **Indexes:** `(meeting_id, status)`, `(student_identity_id)` — see `27`.
- **Security:** `manage_attendance` + membership; five statuses enforced by CHECK + RPC allowlist (VERIFIED).
- **Operational notes:** `not_applicable` is display-only (late joiners, VERIFIED recap comment); late-threshold UNRESOLVED (`17`).

## L. Grading — `grade_batches`, `grade_entries`, `grade_history`

- **Domain:** L | **Purpose:** CSV-uploaded grades with verification/publication. | **Ownership:** Class admins (manage_grades). | **Tenant classification:** TENANT_DERIVED (via offering).
- **Lifecycle:** uploaded → verifying → published (see `18`).
- **Existing equivalent:** none (VERIFIED ABSENT).
- **Decision:** NEW.

`grade_batches` columns: `id uuid PK`, `offering_id uuid NOT NULL`, `university_id uuid NOT NULL`, `uploaded_by uuid NOT NULL`, `source_file_hash text NOT NULL`, `status CHECK (uploaded,verifying,published)`, `created_at`, `published_at NULL`.
`grade_entries` columns: `id uuid PK`, `batch_id uuid NOT NULL →batches`, `student_identity_id uuid NOT NULL`, `component CHECK (assignment,course)`, `score numeric NOT NULL`, `max_score numeric NOT NULL CHECK score<=max`, `published bool NOT NULL DEFAULT false`, `published_at NULL`; UNIQUE `(batch_id, student_identity_id, component)`.
`grade_history` columns: `id uuid PK`, `entry_id uuid NOT NULL`, `old_score numeric NOT NULL`, `new_score numeric NOT NULL`, `changed_by uuid NOT NULL`, `reason text`, `changed_at`; append-only.

- **Indexes:** `(batch_id, published)`, `(offering_id, status)` — see `27`.
- **Security:** manage_grades-gated import/verify/publish RPCs.
- **Operational notes:** CSV format UNRESOLVED (`36` item 1) — format sign-off gates Phase 5F.

## M. Schedule — `schedule_rules`, `schedule_instances`, `schedule_exceptions`

- **Domain:** M | **Purpose:** Recurrence vs meetings vs exceptions. | **Ownership:** Class admins (manage_schedule). | **Tenant classification:** TENANT_DERIVED.
- **Lifecycle:** rule → instances → exceptions (see `19`).
- **Existing equivalent:** `class_course_schedules` weekly rows (VERIFIED `20261029003400` + range `20261105000000`).
- **Decision:** SPLIT/MERGE (see `19`).

`schedule_rules` columns: `id uuid PK`, `offering_id uuid NOT NULL`, `university_id uuid NOT NULL`, `weekday int CHECK 0..6`, `start_time time NOT NULL`, `end_time time NOT NULL CHECK end>start`, `room text`, `timezone text NOT NULL` (snapshot), `effective_from date`, `effective_to date NULL`.
`schedule_instances` columns: `id uuid PK`, `rule_id uuid NOT NULL`, `instance_date date NOT NULL`, `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `status CHECK (scheduled,cancelled,moved)`; UNIQUE `(rule_id, instance_date)`.
`schedule_exceptions` columns: `id uuid PK`, `instance_id uuid NOT NULL`, `kind CHECK (cancel,move,substitute)`, `note text`, `created_by uuid NOT NULL`, `created_at`.

- **Indexes:** `(offering_id)`, UNIQUE `(rule_id, instance_date)`.
- **Security:** tenant RLS; timezone snapshot from `universities.timezone`.
- **Operational notes:** `class_course_schedules` rows migrate to rules (see `30`).

## N. Materials — `course_materials`, `assignment_attachments` (+ storage)

- **Domain:** N | **Purpose:** Course/class files + metadata. | **Ownership:** Uploaders + class admins. | **Tenant classification:** TENANT_DERIVED.
- **Lifecycle:** uploaded → linked → retained (see `20`).
- **Existing equivalent:** `course_materials` (VERIFIED `20261102110000`) + `assignment_attachments` + 5 buckets (VERIFIED `20`).
- **Decision:** KEEP + MODIFY.

`course_materials` columns: `id uuid PK`, `offering_id uuid NOT NULL →course_offerings`, `university_id uuid NOT NULL`, `title text NOT NULL`, `storage_path text NOT NULL`, `mime text`, `size_bytes bigint`, `uploaded_by uuid NOT NULL`, timestamps.
`assignment_attachments` columns: existing + `university_id` backfill.

- **Indexes:** `(offering_id)`, `(assignment_id)`.
- **Security:** table RLS + `storage.objects` policies (independent — see `20` §20.3); signed URLs; tenant path prefix `{university_id}/{target_id}/{uuid}` (RECOMMENDED).
- **Operational notes:** orphan reconciliation + retention per `33` (PROPOSED).

## O. Social / announcements / discussions — `announcements`, `discussion_threads` (candidate)

- **Domain:** O | **Purpose:** Formal announcements (+ candidate discussions/social). | **Ownership:** Class admins (manage_announcements). | **Tenant classification:** TENANT_OWNED.
- **Lifecycle:** draft → published → archived.
- **Existing equivalent:** class posts + `discussion_sessions` (partial; shape UNRESOLVED for posts).
- **Decision:** NEW `announcements`; discussions UNRESOLVED; social excluded (ADR-016).

`announcements` columns: `id uuid PK`, `university_id uuid NOT NULL`, `class_id uuid NOT NULL →classes`, `offering_id uuid NULL →course_offerings`, `author uuid NOT NULL`, `title text NOT NULL`, `body text NOT NULL`, `pinned bool NOT NULL DEFAULT false`, `published_at timestamptz`, `archived_at NULL`.

- **Indexes:** `(class_id, published_at DESC)`, `(offering_id)`.
- **Security:** manage_announcements-gated publish; member read.
- **Operational notes:** candidate schemas in `21` (PROPOSED, excluded until confirmed).

## P. Notifications — `notification_events`, `notification_deliveries`, `notification_preferences`, `push_subscriptions`

- **Domain:** P | **Purpose:** Transactional outbox + deliveries + push. | **Ownership:** Platform machinery. | **Tenant classification:** PLATFORM_CONTROLLED (derived tenant via source).
- **Lifecycle:** queued → claimed → delivered/failed.
- **Existing equivalent:** 4 tables VERIFIED (`20261029000500`, `20261029001000`).
- **Decision:** KEEP + MODIFY (`university_id` derived).

Columns: as existing (VERIFIED) + `university_id uuid NULL` (derived from source row).

- **Indexes:** `(created_at DESC)` for retention sweeps — see `27`.
- **Security:** service-role claim; self preferences; VAPID server-only.
- **Operational notes:** keep API-cron claim/complete pattern (VERIFIED routes; no `pg_cron`).

## Q. Audit — `audit_logs`

- **Domain:** Q | **Purpose:** Cross-cutting immutable operation log. | **Ownership:** Platform machinery (`record_audit()` internal-only, VERIFIED comment). | **Tenant classification:** PLATFORM_CONTROLLED.
- **Lifecycle:** append-only (see `22`).
- **Existing equivalent:** `audit_logs` (VERIFIED `20261029000900`).
- **Decision:** KEEP + MODIFY.

Columns: `id bigint GENERATED ALWAYS AS IDENTITY PK` (VERIFIED), `actor_id uuid NULL SET NULL →auth.users`, `action text NOT NULL`, `entity_type text NOT NULL`, `entity_id uuid`, `class_id uuid NULL SET NULL →classes`, re-keyed `university_id uuid NULL`, `before jsonb`, `after jsonb`, `metadata jsonb`, `created_at timestamptz NOT NULL`.

- **Indexes:** `(created_at DESC)`, `(entity_type, entity_id)`, `(actor_id)` — see `27`.
- **Security:** REVOKE UPDATE/DELETE for consumers; retention via API cron.
- **Operational notes:** actor `SET NULL` preserves history after global deletion (see `07` §7.5).

## R. Platforms / instruments / monitoring (kept as-is)

- **Decision:** KEEP for: `platform_admins` (PLATFORM_CONTROLLED), `google_calendar_connections/mappings`, `personal_calendar_events`/`class_calendar_events`, `auth_activity_events`, `app_activity_events`, `app_error_events`, `developer_incidents/notes`, `feedback_entries`, `rate_limits`, `leave_requests` family + `leave_lecturer_outcomes`, `class_verification_*`, `class_applications`, `class_invitations`, `class_invitation_acceptances/declines`, `assignment_*` reviews/reports/revisions/completions, `saved_assignments`.
- **Operational note:** leave/verification KEEP; lecturer outcomes kept pending lecturer-role decision (UNRESOLVED `36` item 4).

---
