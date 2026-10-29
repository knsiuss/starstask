# Database — StarsTask

Schema source of truth: `supabase/migrations/`.

| File                                             | Contents                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `20261029000100_core_schema.sql`                 | Extensions, tables, constraints, indexes, triggers                           |
| `20261029000200_functions.sql`                   | Profile provisioning, course upsert, listing RPC, path parser, rate limiter  |
| `20261029000300_rls.sql`                         | RLS enablement, policies, column-level grants                                |
| `20261029000400_storage.sql`                     | Private bucket and `storage.objects` policies                                |
| `20261029000500_push_notifications.sql`          | Push tables, constraints, indexes, `updated_at` triggers                     |
| `20261029000600_push_functions.sql`              | Subscription upsert, audience query, claim/complete RPCs                     |
| `20261029000700_push_rls.sql`                    | RLS and column grants for the four push tables                               |
| `20261029000800_function_grants.sql`             | Revokes `anon` EXECUTE that Supabase default privileges add to new functions |
| `20261029000900_classes.sql`                     | Class, application, membership, invitation, review, audit tables             |
| `20261029001000_notification_events.sql`         | Durable notification event queue                                             |
| `20261029001100_class_functions.sql`             | Class workflow and moderation `SECURITY DEFINER` functions                   |
| `20261029001200_class_rls.sql`                   | RLS, column grants, and reviewer storage policy for class data               |
| `20261029001300_class_queries.sql`               | Reviewer read policy and `list_classes` discovery RPC                        |     | `20261029001400_class_public_assignment_filter.sql` | `list_assignments` class filter and `class_id` result |
| `20261029001500_platform_moderation_restore.sql` | Restore is platform-admin only; class admins may hide, not restore           |

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
```

`assignments.user_id` references `auth.users(id) ON DELETE CASCADE`. Deleting a user
removes their assignments and, by cascade, their attachment rows. The push tables also
cascade from `auth.users`, and `saved_assignments` / `notification_deliveries` cascade
from `assignments`.

## 2. Tables

### `profiles`

| Column                     | Type          | Notes                                         |
| -------------------------- | ------------- | --------------------------------------------- |
| `id`                       | uuid PK       | References `auth.users(id)` ON DELETE CASCADE |
| `display_name`             | text NOT NULL | Default `'StarsTask member'`, 1–80 chars      |
| `avatar_url`               | text NULL     | `https://` only                               |
| `created_at`, `updated_at` | timestamptz   | `updated_at` maintained by trigger            |

Created by the `on_auth_user_created` trigger, not by the client.

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
| `classes`                      | Approved, active or archived class                  | Unique slug; slug format, status, and length checks                       |
| `class_applications`           | User request to create a class                      | Decision consistency check; partial unique open application per applicant |
| `class_application_reviews`    | Append-only decision history                        | `decision in ('approved','rejected')`                                     |
| `class_members`                | Membership                                          | PK `(class_id, user_id)`; join source check                               |
| `class_admins`                 | Admin subset of members                             | FK to `class_members` with cascade; no admin without membership           |
| `class_invitations`            | Hashed invitation links                             | Unique 64-char `token_hash`; expiry and usage checks                      |
| `class_invitation_acceptances` | Who accepted which link                             | Unique `(invitation_id, user_id)`                                         |
| `assignment_reviews`           | Submission, approval, rejection, moderation history | Reason required for rejected/unpublished/archived                         |
| `audit_logs`                   | Append-only audit trail                             | Action and entity type format checks; metadata must be an object          |

`assignments` gains `class_id`, `reviewed_by`, `reviewed_at`, `rejection_reason`,
`published_at`, and `revision`. The status check includes `draft`, `pending_review`,
`published`, `rejected`, `unpublished`, and `archived`, plus the legacy `pending`.

## 3. Indexes

| Index                                     | Purpose                                 |
| ----------------------------------------- | --------------------------------------- |
| `assignments_public_recent_idx` (partial) | Newest-first public listing             |
| `assignments_deadline_idx` (partial)      | Deadline sort, published only           |
| `assignments_course_idx`                  | Course filter                           |
| `assignments_owner_recent_idx`            | My Assignments                          |
| `assignments_tags_idx` (GIN)              | Tag filter                              |
| `assignments_search_idx` (GIN)            | Full-text search                        |
| `courses_normalized_name_key` (unique)    | Deduplicated course upsert              |
| `courses_normalized_code_idx`             | Course code lookup                      |
| `assignment_attachments_assignment_idx`   | Attachment embeds and counts            |
| `push_subscriptions_user_active_idx`      | Active devices per user                 |
| `saved_assignments_user_recent_idx`       | Saved list, newest first                |
| `saved_assignments_assignment_idx`        | Audience lookup by assignment           |
| `notification_deliveries_due_idx`         | Claim query (`status, next_attempt_at`) |
| `notification_deliveries_user_recent_idx` | Per-user delivery history               |
| `classes_slug_key` (unique)               | Public class URL lookup                 |
| `classes_active_recent_idx` (partial)     | Public class discovery                  |
| `class_applications_open_applicant_key`   | Duplicate open application prevention   |
| `assignments_class_idx`                   | Class assignment lists                  |
| `assignments_review_queue_idx` (partial)  | Pending review queue per class          |
| `class_invitations_token_hash_key`        | Constant-time invitation lookup         |
| `audit_logs_class_idx` / `_created_idx`   | Class and platform audit views          |

## 4. Functions

| Function                                                                                                           | Security                               | Purpose                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `set_updated_at()`                                                                                                 | invoker                                | Generic `updated_at` trigger                                                             |
| `handle_new_user()`                                                                                                | definer, `search_path = ''`            | Provision a profile from Google metadata; idempotent via `on conflict do nothing`        |
| `prevent_assignment_owner_change()`                                                                                | invoker                                | Reject `user_id` changes                                                                 |
| `create_or_get_course(p_name, p_code, p_department)`                                                               | definer, authenticated only            | Insert-or-select with normalized-name conflict handling                                  |
| `list_assignments(...)`                                                                                            | invoker                                | Filtered, sorted, paginated public listing with `total_count`                            |
| `assignment_id_from_object_path(text)`                                                                             | invoker                                | Extract the assignment UUID from a storage key                                           |
| `consume_rate_limit(key, limit, window)`                                                                           | definer                                | Atomic fixed-window counter                                                              |
| `register_push_subscription(endpoint, p256dh, auth, label)`                                                        | definer, authenticated                 | Upsert the caller's subscription; returns `null` if the endpoint belongs to someone else |
| `list_reminder_audience(assignment_ids)`                                                                           | definer, service_role only             | Opted-in owners and savers with an active device                                         |
| `claim_notification_deliveries(now, limit)`                                                                        | definer, service_role only             | Requeue stale `processing`, claim due rows with `FOR UPDATE SKIP LOCKED`                 |
| `complete_notification_delivery(id, status, error, next)`                                                          | definer, service_role only             | Finish a claimed row; `pending` is a bounded requeue                                     |
| `is_platform_admin()` / `is_class_member(id)` / `is_class_admin(id)` / `can_manage_class(id)`                      | definer, authenticated                 | Role predicates used by RLS policies and functions                                       |
| `apply_for_class(...)` / `revise_class_application` / `withdraw_class_application`                                 | definer, authenticated                 | Applicant-only application workflow                                                      |
| `decide_class_application(id, decision, note, grant_class_admin)`                                                  | definer, platform admin                | Creates the class; optionally grants the class admin role                                |
| `create_class_invitation` / `revoke_class_invitation` / `accept_class_invitation`                                  | definer, class manager / authenticated | Invitation lifecycle and membership grant                                                |
| `assign_class_admin` / `revoke_class_admin` / `remove_class_member` / `set_class_status` / `update_class_metadata` | definer, scoped                        | Role and membership management                                                           |
| `submit_class_assignment` / `revise_class_assignment`                                                              | definer, class member                  | Creates `pending_review`; revision increments and requeues                               |
| `review_class_assignment`                                                                                          | definer, class manager                 | Approve (publish) or reject with reason; blocks self-review                              |
| `moderate_assignment` / `remove_assignment_attachment`                                                             | definer, class/platform admin          | Unpublish, archive, restore, and sensitive-file removal                                  |
| `list_classes(search, semester, limit, offset)`                                                                    | definer, anon + auth                   | Public active-class discovery with member count                                          |
| `record_audit` / `enqueue_notification_event`                                                                      | definer, internal only                 | Append audit entries and queue opted-in push events                                      |

`handle_new_user` reads only `full_name`, `name`, `avatar_url`, `picture`, and the email
local-part as a last-resort display name. It stores no tokens. Non-`https` avatars are
dropped rather than failing signup.

## 5. RLS matrix

| Table                      | anon SELECT                                     | auth SELECT                 | INSERT                           | UPDATE                                      | DELETE     |
| -------------------------- | ----------------------------------------------- | --------------------------- | -------------------------------- | ------------------------------------------- | ---------- |
| `profiles`                 | any row, columns `id, display_name, avatar_url` | same                        | none                             | own row, columns `display_name, avatar_url` | none       |
| `courses`                  | all rows                                        | all rows                    | none (RPC only)                  | none                                        | none       |
| `assignments`              | `status = 'published'`                          | published **or** own        | own `user_id` only               | own only                                    | own only   |
| `assignment_attachments`   | parent published                                | parent published or own     | own parent + own path prefix     | none                                        | own parent |
| `push_subscriptions`       | none                                            | own row (no endpoint/keys)  | own `user_id` only               | own row, `device_label` only                | own row    |
| `notification_preferences` | none                                            | own row                     | own `user_id` only               | own row, preference columns only            | none       |
| `saved_assignments`        | none                                            | own rows                    | own row for a visible assignment | none                                        | own rows   |
| `notification_deliveries`  | none                                            | own rows (read-only)        | none                             | none                                        | none       |
| `rate_limits`              | none                                            | none                        | none                             | none                                        | none       |
| `platform_admins`          | none                                            | none                        | none                             | none                                        | none       |
| `classes`                  | active only                                     | active, own, or managed     | none (RPC only)                  | none (RPC only)                             | none       |
| `class_applications`       | none                                            | own or platform admin       | none (RPC only)                  | none (RPC only)                             | none       |
| `class_members`            | none                                            | own class or platform admin | none (RPC only)                  | none                                        | none (RPC) |
| `class_admins`             | none                                            | own class or platform admin | none (RPC only)                  | none                                        | none (RPC) |
| `class_invitations`        | none                                            | managers, no `token_hash`   | none (RPC only)                  | none                                        | none (RPC) |
| `assignment_reviews`       | none                                            | submitter, reviewer, admin  | none (RPC only)                  | none                                        | none       |
| `audit_logs`               | none                                            | class or platform admin     | none                             | none                                        | none       |
| `notification_events`      | none                                            | own rows                    | none (RPC only)                  | none                                        | none       |

Column-level grants back this up: `assignments` INSERT does not include `status`, and
UPDATE does not include `user_id` or `status`. A client cannot publish into a moderation
state or transfer ownership even before the trigger fires. For push tables, `endpoint`,
`p256dh`, and `auth` are not granted for SELECT, and `notification_deliveries` has no
INSERT/UPDATE/DELETE grant at all.

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
```

The automated equivalent is `pnpm test:integration` (see `tests/integration/rls.test.ts`),
which includes the four push tables and has not been executed in this environment.
