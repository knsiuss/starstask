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

Public listing. Cache: `public, s-maxage=60, stale-while-revalidate=300`.

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

Only `status = 'published'` rows appear. Rate limit: 120 requests / minute per IP.

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

Public. Returns the detail without the owner's auth id or internal storage keys.

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
and up to three `files`. The server sets `pending_review`; the body cannot choose
the status. Rate limit: 10 / hour per user.

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

## `POST /api/auth/signout`

Clears the session and redirects `303` to `/`. `GET` → `405`.

---

## `GET /auth/callback`

OAuth callback. Accepts `code` and `next`. Redirects `303` to the sanitized destination,
or to `/login?error=<reason>` on failure. Never returns JSON.

Reasons: `oauth_cancelled`, `callback_failed`, `rate_limited`, `not_configured`.

---

## Rate limits

| Action         | Limit      | Identifier         |
| -------------- | ---------- | ------------------ |
| Listing        | 120 / min  | Client IP (hashed) |
| Detail         | 180 / min  | Client IP (hashed) |
| Create         | 10 / hour  | User id            |
| Update         | 60 / hour  | User id            |
| Delete         | 30 / hour  | User id            |
| My assignments | 240 / hour | User id            |
| OAuth callback | 30 / 5 min | Client IP (hashed) |

Backend order: Upstash Redis (if configured) → Postgres `consume_rate_limit` → in-process
memory (local development only).
