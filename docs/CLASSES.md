# Classes, roles, and assignment review — StarsTask

This document describes the class management and assignment moderation system:
who can do what, how a class becomes active, how members join, how an assignment
becomes public, and which database policies enforce each boundary.

> Status: implemented in code and migrations. The migrations and RLS policies were
> exercised against a freshly reset local Supabase instance; browser flows and a live
> deployment were not. See [Verified vs unverified](#13-verified-vs-unverified).

## Table of contents

- [1. Product decisions](#1-product-decisions)
- [2. Roles and permissions](#2-roles-and-permissions)
- [3. Class application workflow](#3-class-application-workflow)
- [4. Class management](#4-class-management)
- [5. Invitations and membership](#5-invitations-and-membership)
- [6. Assignment submission and public approval](#6-assignment-submission-and-public-approval)
- [7. Attachments and public visibility](#7-attachments-and-public-visibility)
- [8. Post-publication moderation](#8-post-publication-moderation)
- [9. Notifications](#9-notifications)
- [10. Dashboards](#10-dashboards)
- [11. Audit trail](#11-audit-trail)
- [12. Database and RLS summary](#12-database-and-rls-summary)
- [13. Verified vs unverified](#13-verified-vs-unverified)
- [14. Manual setup](#14-manual-setup)
- [15. Current limitations](#15-current-limitations)

## 1. Product decisions

These decisions are deliberate and must not be reversed by a UI change alone:

1. Any authenticated user may apply to create a class.
2. A class is created only through the Platform Admin approval workflow. The
   reviewer may start it as hidden `draft` or immediately `active`.
3. Applying never grants a role, and approving never grants Platform Admin.
4. Approving an assignment makes it discoverable to signed-in students. There
   is no private-only approved mode.
5. Approved assignments and their attachments require authentication.
6. Class membership controls class management, not access to approved
   assignments.
7. Platform Admin and Class Admin are separate roles with separate scopes.

## 2. Roles and permissions

| Capability                                  | Visitor | Member | Class Admin | Platform Admin |
| ------------------------------------------- | :-----: | :----: | :---------: | :------------: |
| Browse approved assignments and attachments |   no    |  yes   |     yes     |      yes       |
| Browse active classes                       |   yes   |  yes   |     yes     |      yes       |
| Apply to create a class                     |   no    |  yes   |     yes     |      yes       |
| View own class applications                 |   no    |  yes   |     yes     |      yes       |
| Approve or reject a class application       |   no    |   no   |     no      |      yes       |
| View a class roster                         |   no    |  own   |     own     |      all       |
| Create or revoke invitation links           |   no    |   no   |     own     |      any       |
| Review submissions in a class               |   no    |   no   |     own     |      any       |
| Submit an assignment for review             |   no    |  yes   |     yes     |      yes       |
| Moderate published assignments              |   no    |   no   |     own     |      any       |
| Assign or revoke class admins               |   no    |   no   |     own     |      yes       |
| Archive or restore a class                  |   no    |   no   |     own     |      any       |
| Permanently delete an empty class           |   no    |   no   |     own     |      any       |
| Read the platform audit trail               |   no    |   no   |  own class  |      all       |

"Own" means a class the user is a member or admin of. Permission checks are
repeated on the server and inside `SECURITY DEFINER` database functions; the UI
hides controls but that is not the security boundary.

## 3. Class application workflow

An application records:

- proposed name, slug, and optional class code
- course or subject
- institution and lecturer (optional)
- semester and academic year
- description, reason, and optional supporting information

Statuses: `pending`, `approved`, `rejected`, `withdrawn`.

1. A signed-in user submits `apply_for_class`. The applicant id always comes from
   `auth.uid()`; the request body cannot choose it.
2. A partial unique index blocks a second `pending`/`approved` application by the
   same applicant for the same slug.
3. A Platform Admin reviews it and calls `decide_class_application`.
4. Rejection requires a note of at least three characters.
5. Approval creates the course if needed, creates the class, adds the applicant as
   a member, and only creates the class admin row when the reviewer explicitly
   passes `p_grant_class_admin = true`. The reviewer chooses `initialStatus`
   `draft` or `active`; draft classes stay hidden until a class admin activates
   them.
6. If the proposed name or code already exists in the same academic period and
   institution, the API returns `409 possible_duplicate` unless the reviewer
   sends `confirmDuplicate: true`. Nothing is merged automatically.
7. Every decision appends to `class_application_reviews` and `audit_logs`, and
   queues a notification for the applicant.
8. The applicant may revise a `pending` or `rejected` application, which returns it
   to `pending`, or withdraw a `pending` one.

The application status, reviewer, timestamp, and created class are also enforced
by a table check constraint, so a row cannot claim `approved` without a reviewer
and a class.

## 4. Class management

A class has a permanent UUID and slug, an optional human-readable class code,
name, description, course, optional institution and lecturer, semester, academic
year, lifecycle status (`draft`, `active`, or `archived`), a join policy, and
members. The UUID is the only identity used by memberships, invitations,
assignments, submissions, attendance, schedules, and audit rows; names and codes
may repeat across academic periods.

### Lifecycle

```text
draft --> active --> archived
  |                     |
  +---------------------+--> active (restore)
```

- `draft` is visible only to class managers and is excluded from discovery.
- `active` classes are discoverable and accept submissions.
- `archived` classes leave discovery and the default directory, stop accepting
  new submissions, and stay readable to their members and managers. Members,
  assignments, submissions, attendance, schedules, leave requests, and audit
  history are preserved.
- Transitions are enforced inside `set_class_status`; `active -> draft` is
  rejected so a class cannot silently disappear from its members. Class managers
  may archive and restore their own class; platform admins may change any class.
- Every transition writes `class_archived`, `class_activated`, or `class_restored`
  to the audit trail, and `archived_at` / `archived_by` are maintained with it.

### Class codes and duplicate prevention

Codes are trimmed and normalized to uppercase. A partial unique index enforces
`(class_code, academic_year, semester, institution)` only when a code is set, so
the same code can be reused in a different academic period or institution but not
twice inside one period. The database rejects a duplicate even if a caller skips
the UI check.

`find_class_duplicates` powers a warning on the application, settings, and
approval forms. It matches a normalized code or the exact name inside the same
period and institution. It never merges rows: the platform admin must explicitly
send `confirmDuplicate: true` before an approval can proceed through a match.

### Courses

A class group holds one or more **courses** (`class_subjects`). A course belongs
to exactly one class and carries the academic content:

- assignments and announcements (`assignments.subject_id`)
- attendance meetings (`discussion_sessions.subject_id`)
- schedule entries (`class_course_schedules.subject_id`)
- learning materials (`course_materials.subject_id`)

Membership stays at the class level. A student joins the class once and can
reach every course in it; there is no per-course membership. Course records are
owned by their class, so a course id from another class is rejected even when
the caller belongs to both classes.

Every new piece of academic content requires a course. Forms show a course
selector; with a single active course it is preselected but still submitted with
the request. An archived course cannot receive new assignments, meetings,
schedule entries, or materials. Historical rows without a course remain readable
and are never reassigned automatically.

A course that already has records cannot be deleted; it must be archived so the
academic history is preserved. Only an empty course can be deleted.

**Recent assignments** and the class **Assignments** tab also list published
public assignments that use a catalog course the class offers, so work posted
through the public repository for the same course stays visible beside the
class's own content. Those rows remain class-less public entries; only content
posted through the class or its course menu becomes class-scoped.

Course workspace routes:

- `/dashboard/classes/[slug]/courses/[courseId]` — course overview
- `…/courses/[courseId]/assignments`
- `…/courses/[courseId]/materials`
- `…/courses/[courseId]/announcements`
- `…/courses/[courseId]/members`
- `…/courses/[courseId]/attendance`
- `…/courses/[courseId]/schedule`
- `…/courses/[courseId]/settings` — course details and visibility, class admins only

Every tab is a URL, so links and the back button behave normally. **Members**
reuses the parent class roster and states that courses have no separate
memberships. **Settings** edits the course name, code, lecturer, and description,
and archives or reactivates the course; a non-manager who opens it gets a
not-found response. The course header's contextual menu creates an assignment,
uploads a material, or creates an announcement with the current course already
selected, links to the settings page, and deletes an empty course after a
confirmation. When the course has records the API refuses the delete with
`course_has_records` and the dialog points to archiving in the course settings.

The assignments tab filters **All**, **Upcoming** (deadline ahead),
**In progress** (no deadline and not marked done by the caller), **Submitted**
(the caller's own submissions in this course), and **Closed** (deadline passed).
These are read-only views over published rows; the separate submission flow still
creates the caller's own assignment record, and personal completion marks never
become submissions.

The class page lists all courses and links into this workspace. Course CRUD
lives in **Manage Class → Courses**.

Class settings also control how students join. `invitation` (the default) admits
new members only through an invitation link, while `open` also lets a student join
by typing the exact class name. Only a class admin of that class can change the
policy, and every change is recorded in the audit trail.

- `/classes` is the signed-in **My Classes** directory: every class the caller is a
  member of, with search by name or code, academic year, semester, status
  (`active` or `archived`), sort, and a grid/list toggle. Active is the default;
  archived classes are reachable through the archive filter after restoring it.
  Drafts are included for their managers.
- `/classes/join` turns a pasted invitation link into the existing
  `/invite/[token]` flow. It never grants membership itself.
- `/classes/discover` lists active classes publicly with search (name or code) and
  semester filter, for people who have not joined yet.
- `/classes/[slug]` requires a session and shows approved assignments only.
- `/dashboard/classes/[slug]` is the member view: roster, own submissions, and
  published assignments.
- `/dashboard/classes/[slug]/manage` is available to a class admin or Platform
  Admin. It is split into **Overview**, **Courses**, **Members**, **Invites**,
  **Content**, and **Settings** tabs. Overview shows database-backed counters,
  recent audit activity, and class appearance. Courses holds course creation,
  editing, and archive/reactivate actions plus links into each course workspace.
  Members holds roster search plus a per-member action menu that grants or
  revokes the class admin role and removes the member; the database keeps at
  least one admin per class. Invites holds link creation and revocation; Content
  holds searchable published, pending, unpublished, and archived submissions;
  Settings shows read-only class metadata with an explicit
  Edit step, lifecycle controls, and the dependency-aware deletion dialog.
- `/admin/classes/[slug]` is the Platform Admin view focused on roles and status.

Archived classes are hidden from anonymous visitors and from the default active
directory, and stop accepting new submissions. Their existing published
assignments remain public unless moderated separately. Archived settings are
read-only until the class is restored.

### Deleting a class

`delete_class` is available to a class admin of that class or a Platform Admin.
The API and the confirmation dialog require the caller to retype the class code
(or the name when no code is set).

Deletion is deliberately narrow:

- a `draft` class may be deleted when it has no assignments, submissions,
  sessions, attendance, or leave-request history;
- an `active` or `archived` class may be deleted only when every dependent count
  is zero;
- otherwise the delete is refused with `class_has_history`, and archiving is
  offered as the primary action.

`get_class_dependencies` supplies the counts shown to the user, and `delete_class`
re-checks them under a row lock. Student submissions and academic records are
never cascade-deleted merely because a class is removed. The audit entry copies
the slug, code, name, period, and counts into its metadata because
`audit_logs.class_id` is nulled by the foreign key.

## 5. Invitations and membership

Invitation creation is available to a class admin of that class, or a Platform
Admin. Settings:

- lifetime between 1 and 90 days
- 1 to 500 uses
- optional email restriction

Security properties:

- The token is 32 random bytes from `crypto.randomBytes`, base64url encoded.
- Only the SHA-256 hex digest is stored. `token_hash` is not granted to any client
  role, so even the class admin cannot read it.
- Expiry, revocation, usage count, class status, and the email restriction are
  verified inside `accept_class_invitation` under a row lock.
- Membership is unique per `(class_id, user_id)`; a repeat acceptance is
  idempotent and does not consume another use.
- The email restriction is compared with the verified `auth.users.email`, not with
  user-editable metadata.
- Acceptance grants membership only. It never grants a class admin role.

The raw token is returned once by the API so the admin can copy the link. It is
never stored, logged, or written to the audit trail. `/invite/[token]` requires a
Google session before accepting.

## 6. Assignment submission and public approval

Lifecycle:

```text
pending_review --> approved (published, public)
pending_review --> rejected  --> revised --> pending_review
```

Members submit through `submit_class_assignment`, which sets the status itself
after verifying membership and that the class is active. Owners cannot insert a
status directly: the column is not granted for update, and class submissions are
created only through the function.

A class admin's own post never enters that queue. The function stores it as
`draft`, and the web service calls `publish_class_assignment` after the
attachments are uploaded. That function requires both the author and a class
manager, so it cannot publish somebody else's work, and the draft state keeps a
half-saved post out of public search. There is no lecturer account: the class
admin is the class authority, and `review_class_assignment` refuses self-review,
so a queued post would otherwise be stuck forever.

A class admin or Platform Admin reviews through `review_class_assignment`:

- the reviewer must manage the class (checked in the database)
- self-review is rejected
- only `pending_review` or `rejected` rows can be reviewed
- approval sets `status = 'published'` and `published_at`
- rejection requires a reason and stores it on the row
- the decision is appended to `assignment_reviews` and `audit_logs`
- a notification is queued for the submitter

The API requires `confirmPublic: true` for an approval. The review screen shows
the public consequence before the button is enabled and requires the reviewer to
confirm that the files contain no personal or restricted data.

### Content types

Every class post carries an explicit `content_type`, enforced by a check
constraint — never a UI label:

| Type                  | Meaning                                                                                           | Who may create     |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| `lecturer_assignment` | Instructions a lecturer gave, recorded here for the class. `source_label` may name that lecturer. | Members and admins |
| `class_announcement`  | Internal class information, reminders, or coordination. Not an official assignment.               | Class admins only  |

`submit_class_assignment` refuses `class_announcement` unless
`can_manage_class()` is true, so a member cannot post an announcement even by
calling the function directly.

The interface must not imply that StarsTask verified lecturer instructions. The
recording administrator is always shown as the poster; `source_label` is a plain
text attribution the admin typed, and the badge never reads "verified".

### Google Drive links

`drive_url` is optional and restricted at three layers: the Zod schema accepts
only `https://drive.google.com` or `https://docs.google.com` hosts, the column
has a check constraint for the https scheme, and the UI opens the link with
`rel="noopener noreferrer nofollow"`. Students still need access permission from
whoever owns the file; the app never proxies the file.

### Personal completion marks

`assignment_completions` stores one row per student per assignment. It is
personal bookkeeping:

- RLS limits select and delete to `auth.uid()`.
- Insert additionally requires the assignment to be `published` and the caller
  to be an active member of its class.
- Class admins and lecturers cannot read another student's marks; there is no
  aggregate endpoint and no column on the assignment.
- The UI copy avoids "submit" and "hand in" so a tick can never be mistaken for
  coursework being delivered.

### Archive timestamp

`assignments.archived_at` is maintained by a trigger on `status`, so every
moderation path stays consistent without each one remembering to set it.

## 7. Attachments and public visibility

The `assignment-attachments` bucket is private. Every download is a short-lived
signed URL generated on the server.

| Assignment state           | Owner | Class/Platform reviewer | Anonymous |
| -------------------------- | :---: | :---------------------: | :-------: |
| `pending_review`           |  yes  |           yes           |    no     |
| `rejected` / `draft`       |  yes  |           yes           |    no     |
| `published`                |  yes  |           yes           |    yes    |
| `unpublished` / `archived` |  yes  |           yes           |    no     |

This is enforced twice: `assignment_attachments` RLS for the metadata row and
`storage.objects` RLS for the object itself. A pending file cannot be downloaded
by guessing its path, because the storage policy resolves the assignment through
`assignment_id_from_object_path` and requires `status = 'published'` (or the
caller's own prefix).

File type (signature checked), count (maximum three), and size (10 MB) are
validated on upload. A file that fails validation is never attached.

## 8. Post-publication moderation

`moderate_assignment` supports:

- `unpublish` — hides a published assignment; reason required
- `archive` — marks it archived; reason required
- `restore` — publishes an unpublished or archived assignment again; Platform
  Admin only

A class admin may unpublish or archive assignments in their own class, but only a
Platform Admin may restore content. This prevents a class admin from reversing a
platform-level moderation decision. Every action appends to `assignment_reviews`,
`audit_logs`, and queues a notification for the submitter.

Sensitive attachments can be removed with `remove_assignment_attachment`. The
database row is deleted first so the file stops resolving, then the storage object
is removed with the service role. A reason is required. If the storage delete
fails, the object is unreachable but the failure is logged by error name only.

Public discovery is driven by the row state (`status = 'published'`), not by link
hiding. Removing a link from a page never unpublishes content.

### Incident handling

Use this order when published content is reported as unsafe:

1. **Unpublish immediately** with a reason. This takes the assignment out of
   every public listing and makes anonymous signed URLs fail.
2. **Remove the offending attachment** with a reason. This deletes the row first,
   so the file stops resolving even if the storage delete has to be retried.
3. **Revoke invitation links** if the class itself is compromised. Existing
   members keep access; new joins stop.
4. **Archive the class** for a broader incident. It disappears from public
   discovery and rejects submissions, while published assignments stay public
   until separately moderated.
5. **Review the audit trail** for the class and platform. Entries are
   append-only, so they can support a later review.
6. **Record the outcome** outside the application if your process requires a
   formal incident note.

Only a Platform Admin can restore content afterwards. Account suspension is not
implemented, so a compromised account must be disabled in Supabase Auth until
that capability exists.

## 9. Notifications

The existing Web Push pipeline is reused. `enqueue_notification_event` only
queues an event when the user has push enabled and at least one active device.

| Event                        | Recipient                      |
| ---------------------------- | ------------------------------ |
| `class_application_approved` | applicant                      |
| `class_application_rejected` | applicant                      |
| `class_invitation`           | the email-restricted invitee   |
| `class_admin_assigned`       | the new class admin            |
| `submission_received`        | each class admin except self   |
| `assignment_approved`        | submitter                      |
| `assignment_rejected`        | submitter                      |
| `moderation_required`        | submitter after a change       |
| `class_assignment_published` | every member except the author |

Payloads contain a title, a short generic body, and a destination path. They never
contain invitation tokens, emails, student names, or assignment content. A
link-based invitation cannot identify a recipient, so no notification is queued
for it.

A class post is dispatched right after the response is sent (`after()` in the
submission and review routes) instead of waiting for the ten-minute cron pass.
Delivery stays best effort: without VAPID keys or a service-role key the event
waits for the cron, which is also the retry path.

Every event is also stored in the in-app inbox at `/notifications`, where it
stays readable even for a member who never enabled push. The inbox shows unread
state and marks an item read when it is opened or when the user chooses
"Mark all as read".

## 10. Dashboards

- **Member** — `/dashboard`: task counts, priority deadlines, the week's academic
  agenda, recent notifications, pending invitations, active classes, and recent
  published assignments. Class applications live at `/dashboard/applications`;
  personal submissions are edited from their assignment detail page
  (`/assignments/[id]/edit`). The dashboard is read-only: it
  shows only the caller's memberships and published tasks, never other students'
  statistics or class-wide submission data.
- **My Classes** — `/classes`: the caller's own class memberships with search,
  semester filter, sort, and grid/list views. `/classes/join` hands a pasted
  invitation link to `/invite/[token]`.
- **Applications** — `/dashboard/applications` and `/[id]`: create, follow,
  correct, resubmit, and withdraw.
- **Class admin** — `/dashboard/classes/[slug]/manage`: tabbed management with
  Overview counters and activity, member search and role actions, invitation
  links, searchable content moderation, and read-only settings that switch to an
  edit form on request. Class status and deletion sit in Settings.
- **Review** — `/dashboard/classes/[slug]/review/[id]`: submission, attachments,
  review history, decision form with the public notice, moderation controls, and
  attachment removal.
- **Platform admin** — `/admin`: counters, pending applications, verifications,
  published content, and platform audit. `/admin/users` lists accounts,
  `/admin/applications` and `/admin/applications/[id]` record a decision,
  `/admin/classes` and `/admin/classes/[slug]` manage roles and status, and
  `/admin/assignments` links to the review page. See
  [ADMIN_CONSOLE.md](./ADMIN_CONSOLE.md).

Unauthorized pages return 404 rather than revealing that a record exists.

## 11. Audit trail

`audit_logs` is append-only. Clients have `SELECT` only, and RLS limits rows to a
Platform Admin or a class admin of the referenced class. Recorded actions include
application submission, revision, withdrawal and decision; class creation,
update, archival, and deletion; class admin assignment and revocation; member
removal; invitation creation, revocation, and acceptance; assignment submission,
resubmission, approval, rejection, self-publication by a class admin, and
moderation; and attachment removal.

Metadata never includes tokens, email addresses, file paths, or narrative
content. Write functions are not granted to `anon` or `authenticated` except the
user-facing workflow functions, which check `auth.uid()` internally.

## 12. Database and RLS summary

| Table                          | Client access                                      |
| ------------------------------ | -------------------------------------------------- |
| `platform_admins`              | none                                               |
| `classes`                      | read active, own, or managed; writes via functions |
| `class_applications`           | read own or Platform Admin; writes via functions   |
| `class_application_reviews`    | read applicant, class admin, or Platform Admin     |
| `class_members`                | read own class or Platform Admin                   |
| `class_admins`                 | read own class or Platform Admin                   |
| `class_invitations`            | managers only, `token_hash` never granted          |
| `class_invitation_acceptances` | self or manager                                    |
| `assignment_reviews`           | submitter, class admin, Platform Admin             |
| `audit_logs`                   | class admin of that class, Platform Admin          |
| `notification_events`          | own rows only                                      |

Privileged transitions run in `SECURITY DEFINER` functions with an explicit
`search_path`. Role predicates (`is_platform_admin`, `is_class_member`,
`is_class_admin`, `can_manage_class`) are also `SECURITY DEFINER` so RLS policies
can call them without recursion.

## 13. Verified vs unverified

What is verified in this repository:

- ESLint, TypeScript, unit tests, and the production build were run locally and
  their results are recorded in the pull request or handoff.
- Contract tests cover application, invitation, review, moderation, and discovery
  validation rules.
- An opt-in integration suite describes and asserts the expected RLS behaviour. It is
  skipped unless `SUPABASE_TEST_*` is configured.
- All 43 migrations and the seed apply from an empty local Supabase database, and the
  three integration suites (`rls.test.ts`, `class-workflow.test.ts`,
  `authorization-matrix.test.ts`; 85 tests) pass against a freshly reset local instance.
  The CI `integration` job runs the same sequence.

What is **not** verified:

- No migration was pushed to the hosted project; only the disposable local database was
  reset and seeded.
- The signed-in `/classes` directory was rendered from fixture data during layout
  review only. Its real-data rendering against a live project with a signed-in
  session was not exercised.
- Google sign-in, invitation acceptance in a browser, file upload, push delivery,
  and cron scheduling were not tested end to end.
- The CI `integration` job has not yet executed on GitHub-hosted runners.
- No deployment was performed.

Run the same sequence locally (`supabase start`, `supabase db reset --local`, then
`pnpm test:integration` with the exported local credentials) to reproduce the database
verification.

## 14. Manual setup

1. Apply all migrations, including
   `20261029001400_class_public_assignment_filter.sql` and
   `20261029001500_platform_moderation_restore.sql`.
2. Create the first Platform Admin manually. There is intentionally no client or
   API path for this:

   ```sql
   INSERT INTO
     public.platform_admins (user_id, granted_by)
   VALUES
     ('<auth-user-uuid>', NULL) ON CONFLICT (user_id) DO NOTHING;
   ```

   `granted_by` may be `NULL` for the bootstrap grant. Grant subsequent admins
   with the service role only, and record why in the audit trail if your process
   requires it.

3. Confirm the private `assignment-attachments` bucket exists (the storage
   migration creates it).
4. `SUPABASE_SERVICE_ROLE_KEY` is required for attachment removal. Without it the
   API returns a `503 storage_unavailable` error after the row is deleted; the
   file is already unreachable.
5. Configure push VAPID keys if notifications are enabled.

## 15. Current limitations

- **Content reports** cover assignment briefs only. A signed-in reader can report a
  published assignment, and a Platform Admin resolves or dismisses it from `/admin`;
  class pages, attachments, and comments have no report path.
- **Account suspension** is not implemented. There is no account status column or
  moderation action for suspending a user.
- **Attachment replacement** is removal plus upload during a revision; an approved
  public assignment cannot have a file swapped in place.
- **Rejected resubmission notifications** reuse `submission_received` for class
  admins; only the submitter receives the approval/rejection outcome.
- **Invitation discovery in a dashboard** is link-based by design. A user-targeted
  invitation list is not shown; email-restricted invitations send a push event.
- **In-app inbox read state** is tracked per notification. Opening an item marks it
  read, and "Mark all as read" clears the unread list; push delivery is a separate
  channel and never removes the inbox row.
- **Deleting a class leaves its assignments behind** with `class_id = null` and
  the status `archived`, so only a Platform Admin can restore them afterwards.
- **Class detail tabs** are limited to assignments and the existing class actions.
  There is no Materials or Members tab on `/classes/[slug]` because neither
  feature exists as a public surface, so the page does not present a tab that
  would be empty or would expose a roster.
