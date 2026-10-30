# Class representative verification — StarsTask

## 1. Scope and boundaries

A student may declare the position **Class Representative / Ketua Kelas** on their
profile, attach evidence, and ask a platform admin to verify that they represent a
specific class.

**The declaration is a claim, never a permission.** Selecting the position writes one
profile column and nothing else: no membership, no `class_admins` row, no notification,
and no role. The column is not read by any authorization check. The only path to class
admin rights is an explicit platform admin approval, and that approval is scoped to the
single class named in the request.

| In scope                                                | Out of scope (deliberately absent)                    |
| ------------------------------------------------------- | ----------------------------------------------------- |
| A profile position the student chooses                  | Any permission attached to that choice                |
| A request with private PDF/JPG/PNG evidence             | Automatic or AI-based authenticity detection          |
| A platform admin review queue with notes and history    | Class admins approving verification requests          |
| Automatic `class_admins` assignment for the named class | A global "verified representative" role               |
| Revocation of the access an approval granted            | Removing the verification decision from history       |
| Audit entries and push notifications                    | Evidence contents or permanent links in notifications |

Passing file validation only proves that a file is a readable PDF/JPG/PNG. It says
nothing about whether the document is genuine. The decision is a human one, made by a
platform admin, and is recorded as such.

**Status:** code, migration, RLS, API routes, UI, and tests are implemented.
`pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally. The migration
was **never executed against a live database**: no Supabase CLI is installed and no
database command was run. A `.env.local` exists in this worktree and the build reads it,
but the build does not contact the database. §12 lists exactly what that leaves
unverified.

| Piece      | Location                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Schema     | `supabase/migrations/20261029002600_class_verification.sql`                                      |
| Contracts  | `packages/contracts/src/verification.ts`                                                         |
| Validator  | `apps/web/src/lib/storage/verification-evidence.ts`                                              |
| Data       | `apps/web/src/lib/db/verification.ts`                                                            |
| Services   | `apps/web/src/features/verification/{verification,evidence}-service.ts`                          |
| API        | `apps/web/src/app/api/verification/**`, `.../api/admin/verifications/**`                         |
| Student UI | `apps/web/src/app/(workspace)/settings/profile/**`, `.../components/verification/**`             |
| Admin UI   | `apps/web/src/app/(workspace)/admin/verifications/**`, `.../components/admin/verification-*.tsx` |
| Tests      | `apps/web/tests/unit/verification-*.test.ts`                                                     |

---

## 2. Statuses and transitions

A student has no request row until they start one. That absence is what the UI calls
`not_requested`; it is not a stored status.

| Status           | Meaning                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `pending`        | Waiting for a platform admin. A `pending` row with `submitted_at` null is still a draft. |
| `needs_revision` | The reviewer asked for changes. The student can edit and resubmit.                       |
| `rejected`       | The request was denied. No access was granted; the student may start again.              |
| `verified`       | Approved for exactly one class. Approval created the class admin row.                    |

```
                  submit                    approve
  draft ───────────────────► pending ──────────────────► verified
  (pending,                   │  │
   submitted_at null)         │  │ request_revision
                              │  ▼
                              │ needs_revision
                              │  │
                              │  └── revise + submit ──► pending
                              │
                              └── reject ──► rejected ──► (new request allowed)
```

Rules enforced by constraints and functions:

- `submitted_at IS NULL` is what makes a `pending` row a draft. A draft is invisible to
  reviewers, cannot be reviewed, and can be discarded.
- `class_verification_requests_decision_consistency` requires a reviewer, a timestamp,
  and (for `needs_revision`/`rejected`) a note on every decided row; a `pending` row can
  carry none of them.
- `class_verification_requests_submitted_consistency` requires `submitted_at` on every
  status except `pending`, so a decided request can never look unsubmitted.
- `class_verification_requests_no_self_review` rejects a row where `reviewed_by` equals
  `student_id`, in addition to the function check.
- A verified row is not transferable and never means "verified everywhere". One class id
  is stored on the request and every grant uses it.
- The partial unique index `class_verification_requests_active_key` allows one live
  request per student per class (`pending`, `needs_revision`, `verified`). `rejected`
  rows are excluded so a student can retry with fresh evidence.
- A student may hold at most five open requests (`pending` + `needs_revision`) at once.
- The statement is optional, but when present it must be 10–2,000 characters. Review
  notes are 3–2,000 characters. Each request allows at most five active evidence files.
- A verified request cannot be "re-verified". A retried approval fails with `409` because
  the status no longer awaits review; it cannot create a second assignment.

## 3. The profile claim

`profiles.declared_position` is `student` by default with a check constraint for
`student` / `class_representative`. It is written only through
`set_my_declared_position`, which derives the user from `auth.uid()`, validates the
value, and records an audit entry.

The column is **not** part of the client `profiles` SELECT grant. The student reads it
through `get_my_declared_position()`. No RLS policy, API route, or UI permission check
consults it; changing it backwards or forwards changes nothing about access.

The position form states this explicitly: "This only records what you declare — it does
not grant permissions."

## 4. Evidence

- Accepted types: PDF, JPG, PNG. Maximum 10 MB per file, five active files per request.
- The extension selects the expected type; the first bytes must match the signature
  (`%PDF-`, `FF D8 FF`, `\x89PNG\r\n\x1a\n`). A client-declared MIME type is ignored.
- The stored object name is `{student_id}/{request_id}/{uuid}-{sanitized_filename}`,
  built on the server. A crafted filename cannot escape the folder.
- The bucket `verification-evidence` is private, with bucket-level size and MIME limits.
  There is no public URL path.
- Reads use five-minute signed URLs generated server-side. A URL is issued only when the
  storage policy allows the caller to read the object.
- Removal is a soft delete (`removed_at`), so the decision history keeps the record that
  a document existed. The object is then removed from storage; a failed cleanup is
  logged, and the row is already unusable through the app.
- Upload order is object first, row second. If the row fails, the object is deleted
  again, so a rejected upload does not leave an orphan.

Object keys are never returned in API responses, logged, or included in notifications.

## 5. Review and automatic assignment

Only a platform admin can decide a request. `decide_class_verification` runs as
`SECURITY DEFINER` and:

1. Re-checks `is_platform_admin()` — the API check is not the only guard.
2. Locks the request with `FOR UPDATE` and refuses drafts, decided rows, and self-review.
3. For `approve`: requires at least one active evidence file and an active class, then
   inserts `class_members` (`joined_via = 'admin_assignment'`, `ON CONFLICT DO NOTHING`)
   and `class_admins` (`assigned_by` = reviewer, `ON CONFLICT DO NOTHING`).
4. Sets the status (`verified`, `rejected`, or `needs_revision`) and the review fields.
5. Appends a `class_verification_reviews` row and an `audit_logs` entry.
6. Enqueues the student notification **in the same transaction**. The notification
   cannot announce access that was never committed.

Membership is inserted first because `class_admins` has a composite foreign key to
`class_members`. Re-approving is impossible (the status is no longer reviewable), and
both inserts are idempotent, so a retried HTTP call cannot produce a duplicate
assignment.

For `reject` and `request_revision`, a note is mandatory. No membership, admin row, or
other access is created or removed.

## 6. Revocation

`revoke_verified_class_admin` lets a platform admin remove the access an approval
granted:

- Only a `verified` request with an existing `class_admins` row can be revoked.
- It deletes exactly that row for the request's class and does not touch any other class
  or any other assignment source.
- It refuses to remove the last admin of a class, so a class cannot be left
  unmanageable.
- The request remains `verified` in history; the UI distinguishes "verified" from
  "currently has access" by reading the `class_admins` row. Membership is not removed.
- An `access_revoked` review entry, a `class_admin_revoked` audit entry, and a
  notification are recorded.

## 7. Authorization matrix

| Operation                               | anonymous | signed in                       | platform admin |
| --------------------------------------- | --------- | ------------------------------- | -------------- |
| Read own declared position              | ✗         | ✓ (own)                         | ✓ (own)        |
| Change own declared position            | ✗         | ✓ (writes a claim only)         | ✓ (own)        |
| Create / edit / discard own draft       | ✗         | ✓ (own)                         | ✓ (own)        |
| Upload / remove own evidence            | ✗         | ✓ (own, while editable)         | ✓ (own)        |
| Submit own request                      | ✗         | ✓ (own, at least one file)      | ✓ (own)        |
| Read own request and evidence           | ✗         | ✓ (own)                         | ✓ (own)        |
| Read another student's draft            | ✗         | ✗                               | ✗              |
| Read a submitted request / evidence     | ✗         | ✗                               | ✓              |
| Decide a verification request           | ✗         | ✗                               | ✓, never own   |
| Revoke access granted by a verification | ✗         | ✗                               | ✓              |
| Decide as a class admin                 | ✗         | ✗ (no class-scoped path exists) | —              |

There is no endpoint that accepts a `user_id`, a role, or a class admin flag from the
client. Identity and role come from the verified session and are re-checked in SQL.

## 8. Database objects

### `class_verification_requests`

One row per attempt. Columns: `student_id`, `class_id`, `declared_position`,
`statement`, `status`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_note`,
`revision_count`, timestamps. See §2 for the constraints.

### `class_verification_evidence`

`request_id`, `storage_path` (unique), `original_filename`, `mime_type`, `file_size`,
`uploaded_by`, `created_at`, `removed_at`, `removed_by`. The MIME, size, filename, and
path lengths are constrained; removal is all-or-nothing (`removed_at`/`removed_by`
must both be set or both be null).

### `class_verification_reviews`

Append-only history: `actor_id`, `action`, `previous_status`, `new_status`, `note`,
`metadata`. Actions: `created`, `updated`, `submitted`, `resubmitted`, `evidence_added`,
`evidence_removed`, `revision_requested`, `approved`, `rejected`, `access_revoked`.
`actor_id` is not granted to clients, so a student sees the decision and note without
learning which platform admin made it.

### RLS and grants

- RLS is enabled on all three tables. `anon` and `authenticated` have **no**
  INSERT/UPDATE/DELETE grant; every mutation is a definer function.
- SELECT is granted on an explicit column list. `reviewed_by` (requests) and `actor_id`
  (reviews) are withheld. `storage_path` is granted to `authenticated` because the
  server needs it to mint signed URLs; it is never serialized into a response.
- Row visibility: `can_view_class_verification(id)` allows the owner (including their
  draft) or a platform admin for a submitted request only.

### Storage policies

Bucket `verification-evidence`, `public = false`, 10 MiB, `application/pdf`,
`image/jpeg`, `image/png`.

| Operation | Policy                                                                        |
| --------- | ----------------------------------------------------------------------------- |
| SELECT    | owner folder, **or** `can_view_class_verification` for the request in the key |
| INSERT    | owner folder **and** `can_edit_class_verification` for the request in the key |
| DELETE    | owner folder only (service cleanup after a failed upload or discarded draft)  |

The request id is parsed from the object key by `verification_request_id_from_object_path`
and resolved through the database, never trusted as a claimed id.

### Functions

| Function                                                                                      | Security                | Purpose                                            |
| --------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------- |
| `get_my_declared_position()`                                                                  | definer, authenticated  | Read the caller's own claim                        |
| `set_my_declared_position(position)`                                                          | definer, authenticated  | Write the caller's own claim; audit only           |
| `begin_class_verification(class_id, statement)`                                               | definer, authenticated  | Create or resume a draft                           |
| `revise_class_verification(request_id, statement)`                                            | definer, owner          | Edit an editable request                           |
| `add_class_verification_evidence(...)`                                                        | definer, owner          | Register an uploaded object                        |
| `remove_class_verification_evidence(evidence_id)`                                             | definer, owner          | Soft-delete and return the object key              |
| `submit_class_verification(request_id)`                                                       | definer, owner          | Require evidence, move to `pending`, notify admins |
| `discard_class_verification(request_id)`                                                      | definer, owner          | Delete a draft and return its object keys          |
| `decide_class_verification(request_id, decision, note)`                                       | definer, platform admin | Decision plus scoped automatic assignment          |
| `revoke_verified_class_admin(request_id, note)`                                               | definer, platform admin | Remove the granted class admin row                 |
| `is_class_verification_owner` / `can_view_class_verification` / `can_edit_class_verification` | definer                 | Predicates used by RLS and storage policies        |
| `verification_request_id_from_object_path(name)`                                              | stable, authenticated   | Parse the request id from a storage key            |

All functions pin `search_path` and validate their arguments. The role is always derived
from `auth.uid()`; none of them accepts an actor id.

## 9. API endpoints

All routes use the standard envelope (`{ data }` / `{ error }`), are `force-dynamic`,
and run on the Node.js runtime. `503` means Supabase is not configured.

| Method | Path                                                    | Who               | Limit      | Notes                                                                           |
| ------ | ------------------------------------------------------- | ----------------- | ---------- | ------------------------------------------------------------------------------- |
| PUT    | `/api/verification/position`                            | signed in         | 30 / min   | Body `{ position }`. Writes a claim only.                                       |
| POST   | `/api/verification/requests`                            | signed in         | 10 / min   | Body `{ classId, statement? }`. `201 { requestId }`; resumes an existing draft. |
| PATCH  | `/api/verification/requests/[id]`                       | owner, editable   | 60 / min   | Body `{ statement? }`. `{ updated: true }`.                                     |
| DELETE | `/api/verification/requests/[id]`                       | owner, draft only | 20 / min   | `{ discarded: true }`. Submitted rows are `409`.                                |
| POST   | `/api/verification/requests/[id]/submit`                | owner, editable   | 20 / min   | Requires one active file. Already submitted is a no-op (`200`).                 |
| POST   | `/api/verification/requests/[id]/evidence`              | owner, editable   | 30 / min   | Multipart field `file`. `201 { evidenceId, originalFilename }`.                 |
| DELETE | `/api/verification/requests/[id]/evidence/[evidenceId]` | owner, editable   | 60 / min   | Soft-deletes the row, then the object.                                          |
| POST   | `/api/admin/verifications/[id]/decision`                | platform admin    | 120 / hour | Body `{ decision, note?, confirmGrant }`. Returns `{ status }`.                 |
| POST   | `/api/admin/verifications/[id]/revoke`                  | platform admin    | 60 / hour  | Body `{ note, confirmRevoke }`. Returns `{ revoked: true }`.                    |

Error semantics match the rest of the app: `422` with `fieldErrors` for schema failures,
`404` for missing or invisible ids, `403` for an authenticated caller who is not allowed,
`409` for a request in the wrong status, `400` for an invalid or oversized file, `429`
when rate limited.

An approval requires `confirmGrant: true`; rejection and revision require a note of at
least three characters. Unknown keys fail because every schema is `.strict()`.

## 10. UI routes

| Route                       | Who            | Contents                                                                                                                            |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/settings/profile`         | signed in      | Position form, class code entry (with suggestions from joined classes), request cards, evidence uploader, status and reviewer note. |
| `/admin/verifications`      | platform admin | Filters (search, status, class, semester), paged queue, links to details.                                                           |
| `/admin/verifications/[id]` | platform admin | Student and class claim, evidence with short-lived links, decision form, revoke form, history.                                      |
| `/admin`                    | platform admin | "Pending class representative verifications" card with the five oldest submissions.                                                 |

Signed-out visitors are redirected to login; a signed-in non-admin gets `404` on the
admin routes rather than a hint that they exist. Navigation shows "Profile" for
authenticated users and "Verifications" only for platform admins.

Platform administrators see a separate admin profile instead of the student view:
account identity, admin console shortcuts, and the public bio. Student position and
class representative controls are never rendered for an admin account.

A verified request displays whether access is currently active by reading the
`class_admins` row, so a revoked grant does not look like an active one.

## 11. Notifications

| Kind                              | Recipient       | When                                                                         |
| --------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `verification_submitted`          | platform admins | Submit or resubmit (the actor is skipped). Dedupe key includes the revision. |
| `verification_approved`           | student         | Approval, after the assignment commits.                                      |
| `verification_rejected`           | student         | Rejection, with a pointer to the note.                                       |
| `verification_revision_requested` | student         | Revision request.                                                            |
| `class_admin_revoked`             | student         | Access revocation.                                                           |

Bodies contain no evidence, file names, document contents, or permanent URLs.
Notification links are limited to `/settings/profile` and `/admin/verifications`, which
are on the scheduler's safe-path allowlist.

## 12. Verification performed

Run from the repository root on Windows:

| Command                             | Result                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| `pnpm typecheck`                    | Passed                                                      |
| `pnpm lint`                         | Passed with zero warnings                                   |
| `pnpm test`                         | Passed: 32 files, 501 tests (31 are new verification tests) |
| `pnpm build`                        | Passed; the build does not contact the database             |
| `prettier --check` on changed files | Passed                                                      |

**Not verified (no database was contacted; no Supabase CLI is installed):**

- The migration was never applied. It is syntactically formatted by the repository's
  PostgreSQL Prettier plugin, which is not a substitute for execution.
- RLS policies, definer functions, constraints, and the storage policies were not
  exercised against a live database.
- No object was uploaded to `verification-evidence`; signed URLs were not minted against
  real storage.
- No Google sign-in, push delivery, or browser end-to-end flow was run.
- `pnpm test:integration` was not run. It requires a configured project and can create
  and delete rows, so it was not pointed at an unknown database.

### Manual setup

1. Apply `supabase/migrations/20261029002600_class_verification.sql` together with the
   other pending migrations (`supabase db push` remote, `supabase db reset` local).
2. Ensure at least one row exists in `platform_admins` for the reviewer. There is no API
   or UI path to grant it; use the service role as documented in `CLASSES.md`.
3. No new environment variable is required. The bucket is created by the migration.
4. After applying, regenerate types if the project is connected (`pnpm db:types`) and
   confirm `apps/web/src/types/database.ts` still matches.

## 13. Known limits and residual risks

| Risk                                                          | Status                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A valid-looking but forged document is approved               | Human review only; no authenticity detection, by design.                                          |
| A platform admin approves a class the student does not attend | The reviewer sees the claim and evidence; the database cannot prove attendance.                   |
| Evidence stays in storage after a request is decided          | Retained for audit; access is policy-bound and links expire in five minutes.                      |
| Removed evidence remains in history                           | Intentional: soft delete preserves the audit trail.                                               |
| An object survives a failed cleanup                           | Logged with an error code; the row is already inaccessible through the app. No scheduled sweeper. |
| Migration, RLS, and storage never executed                    | Documented above; the first deployment must run the verification queries in `DATABASE.md`.        |
