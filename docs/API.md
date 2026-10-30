# API — StarsTask

Base URL: `NEXT_PUBLIC_SITE_URL`. All responses are JSON unless noted.

## Response envelope

Success:

```json
{ "data": {} }
```

Failure:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please fix the highlighted fields.",
    "fieldErrors": { "title": "Title must be at least 3 characters" }
  }
}
```

`fieldErrors` is present only for validation failures. Messages are safe to display;
internal details are logged server-side without tokens or bodies.

## Status codes

| Code | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| 200  | OK                                                               |
| 201  | Created                                                          |
| 204  | Deleted (no body)                                                |
| 400  | Malformed input, invalid id, bad query, honeypot, too many files |
| 401  | No verified session                                              |
| 403  | Authenticated but not allowed                                    |
| 404  | Missing, or not visible to this caller                           |
| 413  | Request body too large                                           |
| 422  | Zod validation failed                                            |
| 429  | Rate limited                                                     |
| 500  | Unexpected failure (generic message)                             |
| 503  | Supabase not configured                                          |

Inaccessible records return `404`, not `403`, so a caller cannot probe for existence.

---

## `GET /api/assignments`

Authenticated listing. Cache: `no-store`.

Query parameters (all optional):

| Name       | Type   | Rules                                                                    |
| ---------- | ------ | ------------------------------------------------------------------------ |
| `search`   | string | ≤100 chars; matches title/description                                    |
| `course`   | uuid   | Course id                                                                |
| `class`    | uuid   | Only assignments published by that class                                 |
| `semester` | string | Exact match, ≤20 chars                                                   |
| `type`     | enum   | `individual`, `group`, `lab`, `project`, `presentation`, `exam`, `other` |
| `tag`      | string | Exact tag, ≤32 chars                                                     |
| `sort`     | enum   | `newest` (default), `oldest`, `deadline`                                 |
| `page`     | int    | 1–500, default 1                                                         |
| `pageSize` | int    | 1–24, default 12                                                         |

Response `data`:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Normalization exercise",
      "description": "…",
      "course_id": "uuid",
      "class_id": null,
      "course_name": "Database Systems",
      "course_code": "IF2230",
      "lecturer_name": null,
      "semester": "3",
      "academic_year": "2025/2026",
      "assignment_type": "individual",
      "deadline": "2026-10-29T16:59:00+00:00",
      "tags": ["database"],
      "created_at": "2026-10-20T09:00:00+00:00",
      "updated_at": "2026-10-20T09:00:00+00:00",
      "author_display_name": "Ada",
      "author_avatar_url": null,
      "attachment_count": 1,
      "total_count": 42
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 12,
  "totalPages": 4
}
```

Only `status = 'published'` rows appear. Rate limit: 120 requests / minute per user.

---

## `POST /api/assignments`

Authenticated. `Content-Type: multipart/form-data`.

| Field            | Required | Notes                                                     |
| ---------------- | -------- | --------------------------------------------------------- |
| `title`          | yes      | 3–200 chars                                               |
| `description`    | yes      | 10–20,000 chars                                           |
| `courseName`     | yes      | 2–120 chars; upserted into `courses`                      |
| `courseCode`     | no       | ≤20 chars                                                 |
| `department`     | no       | ≤120 chars                                                |
| `lecturerName`   | no       | ≤120 chars                                                |
| `semester`       | no       | ≤20 chars                                                 |
| `academicYear`   | no       | `YYYY/YYYY`                                               |
| `assignmentType` | no       | Enum above                                                |
| `deadline`       | no       | ISO-8601 **with offset**, e.g. `2026-10-29T16:59:00.000Z` |
| `tags`           | no       | JSON array of strings, ≤10                                |
| `referenceUrls`  | no       | JSON array of http(s) URLs, ≤10                           |
| `files`          | no       | 1–3 files, ≤10 MB each                                    |
| `website`        | no       | Honeypot; must be empty                                   |

`user_id` and `status` are **not** accepted. Ownership comes from the verified session;
status defaults to `published`.

Limits: 10 creations / hour per user; body ≤34 MB.

Responses: `201 { "data": { "id": "uuid" } }` · `400` · `401` · `413` · `422` · `429`.

---

## `GET /api/assignments/[id]`

Authenticated. Returns the detail without the owner's auth id or internal storage keys.

```json
{
  "data": {
    "id": "uuid",
    "title": "…",
    "description": "…",
    "course_name": "Database Systems",
    "course_code": "IF2230",
    "course_department": "Informatics",
    "lecturer_name": "Dr. …",
    "semester": "3",
    "academic_year": "2025/2026",
    "assignment_type": "individual",
    "deadline": "2026-10-29T16:59:00+00:00",
    "tags": ["database"],
    "reference_urls": ["https://example.com"],
    "status": "published",
    "created_at": "…",
    "updated_at": "…",
    "author_display_name": "Ada",
    "author_avatar_url": null,
    "attachments": [
      {
        "id": "uuid",
        "originalFilename": "brief.pdf",
        "mimeType": "application/pdf",
        "fileSize": 12345
      }
    ]
  }
}
```

Rate limit: 180 / minute per IP. `404` for missing rows and for pending rows the caller
does not own.

---

## `PATCH /api/assignments/[id]`

Authenticated, owner only. `Content-Type: application/json`. Body ≤64 KB.

Any subset of: `title`, `description`, `courseName`, `courseCode`, `department`,
`lecturerName`, `semester`, `academicYear`, `assignmentType`, `deadline`, `tags`,
`referenceUrls`.

- Omitted field → unchanged.
- `null` → clears an optional field.
- Unknown keys (including `user_id`, `status`, `id`) → `422` (schema is strict).
- Rate limit: 60 / hour per user.
- `404` when the caller does not own the row.

Response: `200 { "data": { "id": "uuid" } }`.

Attachments cannot be changed through this endpoint.

---

## `DELETE /api/assignments/[id]`

Authenticated, owner only. Deletes the row (cascading attachment records), then removes
storage objects. Rate limit: 30 / hour per user.

Responses: `204` · `401` · `404` · `429`.

---

## `GET /api/my-assignments`

Authenticated. Query: `status` (`published` | `pending`), `page` (1–500), `pageSize`
(1–50, default 20).

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "…",
        "status": "published",
        "deadline": null,
        "created_at": "…",
        "updated_at": "…",
        "course_name": "Database Systems",
        "course_code": "IF2230",
        "attachment_count": 2
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

Rate limit: 240 / hour per user.

---

## Classes

All class endpoints return `404` when the caller cannot see the class or record.
Role checks are repeated inside the database functions.

### `GET /api/classes`

Public discovery. Cache: `public, s-maxage=60`.

| Name       | Type   | Rules                              |
| ---------- | ------ | ---------------------------------- |
| `search`   | string | ≤100 chars; name, course, lecturer |
| `semester` | string | Exact match, ≤20 chars             |
| `page`     | int    | 1–500, default 1                   |
| `pageSize` | int    | 1–24, default 12                   |

Returns active classes with `member_count` and `total_count`. Rate limit: 120 /
minute per IP.

### `GET /api/classes/[slug]`

Public class metadata. Signed-in callers additionally receive `role`:
`{ isPlatformAdmin, isMember, isAdmin, canManage }`.

### `PATCH /api/classes/[slug]`

Class admin or platform admin. JSON body:

```json
{
  "name": "Database Systems — Class B",
  "description": "Ten characters minimum.",
  "courseName": "Database Systems",
  "institution": "Example University",
  "lecturerName": "Dr. Example",
  "semester": "1",
  "academicYear": "2025/2026"
}
```

The slug cannot change. Rate limit: 60 / hour per user.

### `DELETE /api/classes/[slug]`

Class admin of that class, or platform admin. Body
`{ "confirmName": "the class name" }`; the name is compared case-insensitively
with the stored one, so a mistyped confirmation is rejected with `422`. Deleting
cascades members, invitations, sessions, leave requests, schedule, and
verification rows, and archives the class's published assignments. Rate limit: 5 /
hour per user.

### `POST /api/classes/[slug]/status`

Platform admin only. Body `{ "status": "active" | "archived" }`. Rate limit: 60
/ hour.

### `GET /api/classes/[slug]/members`

Class admin or platform admin. Returns display name, avatar, join source, join
time, and admin flag. Private profile fields and emails are never returned.

### `DELETE /api/classes/[slug]/members`

Class admin or platform admin. Body `{ "userId": "uuid" }`. Removing an admin
removes the role too; the last admin cannot be removed.

### `POST /api/classes/[slug]/admins`

Platform admin only. Body `{ "userId": "uuid" }`. Adds membership if needed,
then grants the class admin role.

### `DELETE /api/classes/[slug]/admins`

Platform admin only. Body `{ "userId": "uuid" }`. The class always keeps at
least one admin.

### `GET /api/classes/[slug]/submissions`

Class admin review queue. Query: `status` (default `pending_review`) and bounded
`page`/`pageSize`. Allowed statuses: `pending_review`, `rejected`, `published`,
`unpublished`, `archived`.

### `POST /api/classes/[slug]/submissions`

Class member. `multipart/form-data` with `title`, `description`, optional
`assignmentType`, `deadline`, `tags` (JSON array), `referenceUrls` (JSON array),
and up to three `files`. The server picks the status: `pending_review` for a
member, or `draft` followed by an immediate publish for a class admin's own post.
The body cannot choose the status. Returns `{ id, status }`. Rate limit: 10 /
hour per user.

### `PATCH /api/classes/[slug]/submissions/[id]`

Owner of a rejected or draft submission. Same fields as creation. New files are
added to the existing set (maximum three total). Returns the row to
`pending_review` and increments `revision`.

### `POST /api/classes/[slug]/submissions/[id]/review`

Class admin or platform admin.

```json
{ "decision": "approved", "confirmPublic": true, "reason": null }
```

`confirmPublic` must be `true` for an approval; rejection requires a reason of at
least three characters. Self-review is rejected by the database.

### `GET /api/classes/applications`

Signed-in caller's own applications, newest first.

### `POST /api/classes/applications`

Any signed-in user. Fields: `proposedName`, `proposedSlug`, `courseName`,
`semester`, `academicYear`, `description`, `reason`, and optional `institution`,
`lecturerName`, `supportingInfo`. The applicant is the verified session user.
Rate limit: 5 / hour.

### `PATCH /api/classes/applications/[id]`

Applicant only, for a `pending` or `rejected` application. Re-validates every
field and returns it to `pending`.

### `DELETE /api/classes/applications/[id]`

Applicant only, for a `pending` application. Sets `withdrawn`.

### `POST /api/admin/class-applications/[id]/decision`

Platform admin only.

```json
{
  "decision": "approved",
  "note": "Optional for approval, required for rejection",
  "grantClassAdmin": true
}
```

`grantClassAdmin` is the only way the applicant becomes the class admin, and only
a platform admin can set it.

### `GET /api/classes/[slug]/invitations`

Class admin or platform admin. Returns invitation metadata. `token_hash` is never
selected or returned.

### `POST /api/classes/[slug]/invitations`

Class admin or platform admin.

```json
{ "expiresInDays": 7, "maxUses": 1, "email": "optional@example.test" }
```

Response `data` includes `token`, `invitePath`, `expiresAt`, `maxUses`, and
`emailRestriction`. **The raw token is returned exactly once** and is never stored.
Rate limit: 30 / hour.

### `DELETE /api/classes/[slug]/invitations/[id]`

Class admin or platform admin. Revokes the link permanently.

### `POST /api/classes/invitations/accept`

Signed-in user. Body `{ "token": "…" }`. Verifies hash, expiry, revocation, usage
limit, active class, and email restriction. Grants membership only. Rate limit: 20
/ hour.

### `POST /api/assignments/[id]/moderation`

Class admin of the owning class or platform admin.

```json
{ "action": "unpublish", "reason": "Contains a student name in the footer." }
```

Actions: `unpublish`, `archive`, `restore`. `restore` needs no reason; the others
do. `restore` is platform-admin only; a class admin cannot reverse a platform
moderation decision.

### `DELETE /api/assignments/[id]/attachments/[attachmentId]`

Class admin or platform admin. Body `{ "reason": "…" }`. Deletes the attachment
row, then the storage object. Returns `503 storage_unavailable` when
`SUPABASE_SERVICE_ROLE_KEY` is missing; the file is already unreachable through
the app at that point.

### `POST /api/assignments/[id]/reports`

Signed-in user, published assignment only. Body:

```json
{ "reason": "wrong_deadline", "note": "The lecturer moved it to 12:00." }
```

`reason` is one of `wrong_deadline`, `wrong_details`, `duplicate`,
`broken_attachment`, `other`. `note` is optional but must be 5–2,000 characters
when present. Upserts the caller's single open report and returns `201 { id }`.
Rate limit: 20 / hour. The report never edits the assignment.

### `PATCH /api/admin/assignment-reports/[id]`

Platform admin. Body `{ "status": "resolved" | "dismissed", "note": "…" }`.
Closes an open report and writes an audit entry. Returns `200 { id, status }`.
A second review of the same report is rejected by the database function. See
[TRUST_LOOP.md](TRUST_LOOP.md).

### `GET /api/classes/[slug]/calendar`

Public, unauthenticated, rate limited (120 / minute per client). Returns
`text/calendar; charset=utf-8` with published assignment deadlines and
`visibility = 'public'` sessions only. Member-only sessions are excluded because
the feed may be cached outside the app. Cached for 5 minutes; `404` when the
class is missing or archived.

## `POST /api/auth/signout`

Clears the session and redirects `303` to `/`. `GET` → `405`.

---

## Discussion sessions

Full behaviour, permissions, and RSVP rules are in [SESSIONS.md](SESSIONS.md).

### `GET /api/sessions`

Anyone. Query: `class` (uuid), `type` (`online` \| `in_person`), `status`
(`upcoming` default, `all`, `scheduled`, `cancelled`, `completed`), `from`, `to`,
`page`, `pageSize` (≤100). Returns `{ items, total, page, pageSize, totalPages }`,
each item carrying class, organiser, and attendance counts. Anonymous callers see
public sessions only, without `agenda` or `meetingUrl`.

### `POST /api/sessions`

Class manager. Body: `classId`, `title`, `description`, optional `agenda`,
`sessionType`, `meetingUrl` (https, required when online), `location` (required
when in person), `startsAt`, `endsAt` (both with an explicit offset), `timeZone`,
optional `capacity`, `registrationDeadline`, `visibility`, `assignmentId`.
Unknown fields are rejected. `201` with the created session.

Errors: `400 invalid_input` with `fieldErrors`, `403 forbidden` when the caller
does not administer that class, `409 conflict`.

### `GET /api/sessions/[id]`

Anyone who may view the session. `404 not_found` otherwise — the response never
distinguishes "missing" from "not allowed".

### `PATCH /api/sessions/[id]`

Class manager. Same body as create, without `classId`. Only `scheduled` sessions
are editable (`400 invalid_state` otherwise). A changed start time notifies
participants and reconciles reminders and calendar mappings.

### `POST /api/sessions/[id]/status`

Class manager. Body `{ "status": "scheduled" | "cancelled" | "completed" }`.
Cancelling or completing skips pending reminders and marks calendar mappings
`out_of_sync`; cancelling notifies participants once; `scheduled` reopens a
cancelled session.

### `PUT` / `DELETE /api/sessions/[id]/rsvp`

Signed-in viewer. `PUT` body `{ "status": "going" | "maybe" | "not_going" }`;
`DELETE` removes the caller's RSVP. Neither accepts a user id. Returns fresh
counts (`goingCount`, `maybeCount`, `capacity`, and the caller's `status`).

Errors: `409 session_full`, `409 registration_closed`, `409 not_scheduled`,
`403 forbidden`.

### `POST /api/sessions/[id]/calendar-sync`

Signed-in viewer with a connected calendar. Creates, updates, or deletes the
caller's own Google Calendar event for the session. Idempotent: repeat calls
update the same event.

Errors: `503 calendar_not_configured`, `409 calendar_not_connected`,
`409 calendar_reconnect_required`, `502 calendar_unavailable`, `502 calendar_error`.

## Academic calendar

Full behaviour and the permission matrix are in [SCHEDULE.md](SCHEDULE.md).
The calendar page itself is server-rendered; these routes write events.

### `POST /api/calendar/personal`

Signed-in user. Body: `title`, optional `description`, `startsAt`, `endsAt`
(both with an explicit offset), optional `timeZone` (default `Asia/Jakarta`),
optional `location`. `201` with the new event id. Personal events are visible
only to the caller.

### `PATCH` / `DELETE /api/calendar/personal/[id]`

Owner only. `PATCH` replaces the same fields as create. `DELETE` removes the
event. Someone else's id returns `404 not_found`.

### `PATCH /api/calendar/personal/[id]/status`

Owner only. Body `{ "status": "published" | "cancelled" | "archived" }`.

### `POST /api/classes/[slug]/calendar-events`

Class manager of that class only. Body: `title`, optional `description`,
`eventType` (`class_schedule` \| `exam` \| `academic_event`), `startsAt`,
`endsAt`, optional `timeZone`, optional `location`, optional `subjectId` that
must belong to the class. Unknown fields are rejected. `201` with the event id.

### `PATCH` / `DELETE /api/classes/[slug]/calendar-events/[eventId]`

Class manager. `PATCH` replaces the event fields. `DELETE` archives the event
(status `archived`) instead of hard deleting it, so the group history survives.

### `PATCH /api/classes/[slug]/calendar-events/[eventId]/status`

Class manager. Body `{ "status": "published" | "cancelled" | "archived" }`.
Cancelling keeps the event visible and struck through; publishing reopens it.

## Absence requests

Student absence collection and forwarding. StarsTask never approves an absence,
so no endpoint here records a decision. `forwarded` means "included in a
completed forwarding package" and nothing more; the lecturer decides outside the
product. Full behaviour: `docs/LEAVE_REQUESTS.md`.

### `GET /api/leave-requests`

Signed-in student. Lists the caller's own requests across their classes,
including drafts and cancelled requests. Query: `status`, `from`, `to`, `page`,
`pageSize`.

### `POST /api/leave-requests`

Signed-in student. Creates a draft. Body: `classId` plus the optional absence
fields. Only `classId` is required — a draft may be half-filled.

Returns `201` with `{ id, reference }`. Rate limited to 20 per minute.

### `PATCH /api/leave-requests/[id]`

Owner only, and only while `draft`. Body: the absence fields. Errors:
`409 not_editable`, `404 not_found`.

### `POST /api/leave-requests/[id]/submit`

Owner only. Validates that the dates, reason, and explanation are present and
that at least one evidence file is attached, then moves the request to
`submitted`. Errors: `422 incomplete`, `409 invalid_transition`.

### `POST /api/leave-requests/[id]/cancel`

Owner may cancel a `draft` or `submitted` request; a class admin may cancel a
`submitted` request in their class. Body: `{ note }` (optional, up to 2000
chars). Moves the request to `cancelled`, which is terminal. Errors:
`409 invalid_transition`, `404 not_found`.

### `POST /api/leave-requests/[id]/evidence`

Owner only, multipart `file`. Accepts PDF, JPG, PNG up to 10 MB, validating the
leading bytes rather than the declared MIME type. Returns `201` with
`{ id, originalFilename }`. Errors: `400 invalid_file`, `400 too_many_files`,
`409 not_editable`.

### `DELETE /api/leave-requests/[id]/evidence/[evidenceId]`

Owner only. Soft-deletes the row and removes the stored object. Returns `204`.

### `POST /api/leave-requests/[id]/ocr`

Owner only. Body: `{ fieldSources }` — records which fields the student
confirmed from the document. Provenance only; it never advances the workflow.

### `GET /api/classes/[slug]/leave-requests/export`

Class admin. `?format=csv|summary|complete|zip`, optional `from` / `to`. Returns
a file download (`Content-Disposition: attachment`). Only `submitted`,
`forwarded`, and `cancelled` requests are included — never drafts. Rate limited
to 20 per minute.

### `POST /api/classes/[slug]/leave-requests/forward`

Class admin. Body: `requestIds`, `recipientName`, optional `recipientEmail`,
`reportFormat`, `idempotencyKey`. Builds the PDF first, then records the
forwarding and marks the requests `forwarded`. Returns the PDF itself with
`X-Starstask-Forwarding-Reference`, `X-Starstask-Request-Count`, and
`X-Starstask-Missing-Attachments`.

Retrying with the same `idempotencyKey` returns the original package instead of
creating a second one. Errors: `409 not_eligible`, `409 conflict`,
`409 invalid_selection`.

## Class representative verification

A declared position is a claim, never a permission. Only a platform admin
decision moves a request to `verified`, and only that decision creates the
`class_admins` row for the request's class. Full behaviour and schema:
[CLASS_VERIFICATION.md](CLASS_VERIFICATION.md).

### `PUT /api/verification/position`

Signed in. Body `{ "position": "student" | "class_representative" }`. Writes the
caller's profile claim only; it grants no role, membership, or notification.
Rate limited to 30 per minute.

### `POST /api/verification/requests`

Signed in. Body `{ "classId": "uuid", "statement": "optional" }`. Creates a
draft, or resumes the caller's existing unfinished draft for that class, and
returns `201 { "requestId": "uuid" }`. The class must be active. One live
request per student per class; at most five open requests. Rate limited to 10
per minute.

Errors: `422 validation_error`, `409 conflict` (a request is already open).

### `PATCH /api/verification/requests/[id]`

Owner only, while the request is a draft or `needs_revision`. Body
`{ "statement": "optional" }`. Returns `{ "updated": true }`. Rate limited to
60 per minute.

### `DELETE /api/verification/requests/[id]`

Owner only, draft only. Removes the draft and its stored objects. Returns
`{ "discarded": true }`. A submitted request is `409 not_discardable`. Rate
limited to 20 per minute.

### `POST /api/verification/requests/[id]/submit`

Owner only. Requires at least one active evidence file, moves the request to
`pending`, and notifies platform admins. Repeating the call for an already
submitted request is a no-op (`200`). Drafts may be resubmitted after a
revision request. Rate limited to 20 per minute.

Errors: `400 evidence_required`, `409 not_submittable`.

### `POST /api/verification/requests/[id]/evidence`

Owner only, editable request, multipart field `file`. PDF, JPG, or PNG up to
10 MB, validated by leading bytes; at most five active files. Returns `201`
`{ "evidenceId": "uuid", "originalFilename": "…" }`. The object is stored under
the caller's private `{uid}/{requestId}/` prefix. Rate limited to 30 per minute.

Errors: `400 invalid_file`, `400 too_many_files`, `409 not_editable`,
`413 file_too_large`.

### `DELETE /api/verification/requests/[id]/evidence/[evidenceId]`

Owner only, editable request. Soft-deletes the evidence row, then removes the
stored object. Rate limited to 60 per minute.

### `POST /api/admin/verifications/[id]/decision`

Platform admin only, and never the applicant. Body:

```json
{
  "decision": "approve",
  "note": "Optional for approval, required for rejection/revision",
  "confirmGrant": true
}
```

`decision` is `approve`, `reject`, or `request_revision`. `confirmGrant` must be
`true` for approval. Returns `{ "status": "verified" }` (or `rejected` /
`needs_revision`). Approval runs in one transaction: membership, class admin
assignment for that class, status, history, audit, and the notification.
Repeating an approval fails with `409` because the request is no longer awaiting
review; it cannot create a second assignment. Rate limited to 120 per hour.

Errors: `403 forbidden`, `404 not_found`, `409 conflict` (wrong status or
self-review), `422 validation_error`.

### `POST /api/admin/verifications/[id]/revoke`

Platform admin. Body `{ "note": "…", "confirmRevoke": true }`. Deletes only the
`class_admins` row for the verified class, keeps the verification history, and
refuses to remove the last admin of a class. Returns `{ "revoked": true }`.
Rate limited to 60 per hour.

## Google Calendar connection

### `GET /api/integrations/google-calendar/start`

Signed-in user. Redirects `303` to Google's consent screen with a single-use
state bound to the caller in an httpOnly cookie. Redirects to `/login` when
signed out, and to `/settings/calendar?error=not_configured` when the four
calendar environment variables are missing.

### `GET /api/integrations/google-calendar/callback`

OAuth callback. Validates the state against the cookie and the session, exchanges
the code, stores the encrypted tokens, then redirects `303` to
`/settings/calendar?connected=1` or `?error=<code>`. It never returns JSON and
never touches the StarsTask session, so connecting cannot sign the user out.

Error codes: `not_configured`, `session_expired`, `invalid_state`, `cancelled`,
`callback_failed`, `transient`, `storage_failed`.

### `POST /api/integrations/google-calendar/disconnect`

Signed-in user. Revokes the grant at Google (best effort), deletes the event
mappings and the connection, and keeps the user signed in.

## `GET /api/cron/session-jobs`

`Authorization: Bearer <CRON_SECRET>`. Runs the session reminder pass, then drains
up to 20 due calendar syncs. Logs aggregate counters only. Returns `503` when the
service role or push configuration is missing, and still attempts the calendar
phase when the reminder phase fails.

---

## `GET /auth/callback`

OAuth callback. Accepts `code` and `next`. Redirects `303` to the sanitized destination,
or to `/login?error=<reason>` on failure. Never returns JSON.

Reasons: `oauth_cancelled`, `callback_failed`, `rate_limited`, `not_configured`.

---

## Rate limits

| Action                        | Limit      | Identifier         |
| ----------------------------- | ---------- | ------------------ |
| Listing                       | 120 / min  | Client IP (hashed) |
| Detail                        | 180 / min  | Client IP (hashed) |
| Create                        | 10 / hour  | User id            |
| Update                        | 60 / hour  | User id            |
| Delete                        | 30 / hour  | User id            |
| My assignments                | 240 / hour | User id            |
| OAuth callback                | 30 / 5 min | Client IP (hashed) |
| Session list / detail         | 240 / min  | Client IP (hashed) |
| Session create                | 30 / hour  | User id            |
| Session edit / status         | 60 / hour  | User id            |
| Session RSVP                  | 120 / hour | User id            |
| Calendar sync                 | 60 / hour  | User id            |
| Calendar connect / disconnect | 20 / hour  | User id            |

Backend order: Upstash Redis (if configured) → Postgres `consume_rate_limit` → in-process
memory (local development only).
