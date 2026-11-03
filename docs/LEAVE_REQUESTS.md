# Student absence requests — StarsTask

## 1. Scope

StarsTask collects a student's absence request and its supporting document, lets
a class admin review it, and keeps the attendance record consistent with the
decision. A forwarding package can still be generated for the lecturer.

| In scope                                        | Out of scope (deliberately absent)                    |
| ----------------------------------------------- | ----------------------------------------------------- |
| Student records dates, reason, and evidence     | A lecturer decision dashboard                         |
| Admin checks completeness and legibility        | Any claim that the lecturer received or read the file |
| Admin approves or rejects with an optional note | Treating an absence as attendance                     |
| Approval marks covered sessions `excused`       | A second attendance system for absence requests       |
| A record of what was forwarded, to whom, when   | Editing the past: history is append-only              |

`approved` is an academic decision recorded by a class admin for their own
class. It is **not** the same as attendance: approval marks the sessions covered
by the dates as `excused`, and an excused session is never counted as present.
`rejected` leaves attendance unchanged. `forwarded` remains a separate hand-off
state meaning the request was included in a package that was generated and
recorded; it is not a decision.

**Status:** the review workflow is implemented in code, RLS, exports, and tests.
The migrations that introduce it (`20261031170000_absence_review_attendance.sql`
and the attendance-summary migration) were applied to the live project on
2026-11-02, so `review_leave_request` and the new statuses exist there. The
workflow has not yet been exercised end to end in the UI.

| Piece        | Location                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| Schema       | `supabase/migrations/20261029002200_leave_requests.sql`                              |
| Functions    | `supabase/migrations/20261029002300_leave_functions.sql`                             |
| RLS          | `supabase/migrations/20261029002400_leave_rls.sql`                                   |
| Grants       | `supabase/migrations/20261029002500_leave_grants.sql`                                |
| Cancellation | `supabase/migrations/20261030090000_absence_cancellation.sql`                        |
| Review       | `supabase/migrations/20261031170000_absence_review_attendance.sql`                   |
| Contracts    | `packages/contracts/src/leave.ts`                                                    |
| Helpers      | `packages/shared/src/leave.ts`, `packages/shared/src/csv.ts`                         |
| Data         | `apps/web/src/lib/db/leave.ts`                                                       |
| Services     | `apps/web/src/features/leave/*.ts`                                                   |
| Reports      | `apps/web/src/features/leave/reports/{pdf,csv,zip}.ts`                               |
| OCR          | `apps/web/src/lib/ocr/*`                                                             |
| Storage      | `apps/web/src/lib/storage/leave-evidence.ts`                                         |
| API          | `apps/web/src/app/api/leave-requests/**`, `.../api/classes/[slug]/leave-requests/**` |
| UI           | `apps/web/src/components/leave/*`, `apps/web/src/app/(workspace)/leave-requests/**`  |

---

## 2. Statuses and transitions

Five public statuses, plus an internal `draft`:

| Status      | Meaning                                                         |
| ----------- | --------------------------------------------------------------- |
| `draft`     | The student is still filling it in. Private to them.            |
| `submitted` | Sent to the class admin. Waiting for a decision.                |
| `approved`  | Decided by a class admin. Covered sessions become `excused`.    |
| `rejected`  | Decided by a class admin. Attendance is unchanged.              |
| `forwarded` | Included in a completed forwarding package. **Not a decision.** |
| `cancelled` | Withdrawn by the student, or cancelled by the class admin.      |

```
                        submit                 approve
  draft ─────────────────────────> submitted ───────────> approved
    │                                │   │
    │ cancel                         │   └──reject──────> rejected
    │                                │ cancel              (terminal)
    └────────────> cancelled <───────┘
                                     └──forward──────> forwarded (legacy)
```

Rules:

- A `draft` may be half-filled. `leave_requests_complete` demands the required
  columns for `submitted`, `approved`, `rejected`, and `forwarded`; a cancelled
  draft stays incomplete and that is valid.
- `leave_requests_forwarded_at_consistency` ties `status = 'forwarded'` to
  `forwarded_at IS NOT NULL`, and `leave_requests_cancel_consistency` ties
  `status = 'cancelled'` to `cancelled_at IS NOT NULL`.
- `approved`, `rejected`, `forwarded`, and `cancelled` are terminal.
- `submit_leave_request` only accepts `draft`; anything else raises `SS012`.
- `review_leave_request` only accepts a `submitted` request; anything else
  raises `SS012`. Only a manager of the request's class may call it, and a
  manager may not review their own request (`42501`).
- A student may cancel their own `draft` or `submitted` request. A class admin
  may cancel a `submitted` request in their class. Nobody may cancel an
  `approved`, `rejected`, or `forwarded` one.
- Every transition is validated in the `SECURITY DEFINER` function that performs
  it. There is no client-writable status column.

The decision time and author live in `leave_request_history` (actions
`approved` / `rejected`), not in extra columns. The request holds its current
status; the append-only history explains how it got there.

The retired `needs_revision` state is folded into `submitted` by the
cancellation migration. Rows written before it still carry the old value; the
data layer maps them to `submitted`.

### Attendance consequence of approval

Approval runs in the same transaction as the status change:

1. Sessions in the request's class within the Jakarta calendar date range, and
   starting after the student joined, are selected.
2. An existing `absent` or `excused` check-in becomes `excused`, with
   `reviewed_by` / `reviewed_at` set to the reviewing admin.
3. A session with no check-in gets one `excused` row. The unique constraint
   `(session_id, user_id)` makes a retry a no-op.
4. Existing `present` and `late` rows are **never** changed. They are evidence
   that the student attended, and approval must not erase attendance.
5. Cancelled sessions and sessions before `class_members.joined_at` are ignored.

Rejection writes no attendance rows at all. The shared percentage policy then
applies: excused is not present and is excluded from the eligible denominator,
so an approved absence neither helps nor hurts the attendance rate.

### The three dates

`leave_start_date` / `leave_end_date` (the database columns keep their original
names), `document_issue_date`, and `submitted_at` answer three different
questions and are stored, exported, and displayed separately:

| Date                | Question it answers                 |
| ------------------- | ----------------------------------- |
| Absence start / end | Which days is the student away?     |
| Document issue date | When was the letter written?        |
| Submitted at        | When did the student send it to us? |

Nothing infers one from another. The form labels the issue date explicitly
("not the absence dates and not the submission date"), the detail page lists all
three with a note saying so, and the CSV has a column for each.

---

## 3. Data model

### `leave_requests`

| Column                      | Type        | Notes                                                          |
| --------------------------- | ----------- | -------------------------------------------------------------- |
| `id`                        | uuid PK     |                                                                |
| `reference`                 | text UNIQUE | `LR-` + 12 uppercase hex, generated by default                 |
| `student_id`                | uuid        | → `profiles(id)`                                               |
| `class_id`                  | uuid        | → `classes(id)`                                                |
| `leave_start_date`          | date        | Null while a draft is incomplete                               |
| `leave_end_date`            | date        | Checked `>= leave_start_date` when both present                |
| `reason_category`           | text        | `illness` / `family_matter` / `other`                          |
| `explanation`               | text        | 10–4000 chars once submitted                                   |
| `document_issue_date`       | date        | Optional; never derived from the absence dates                 |
| `status`                    | text        | The statuses above, default `draft`                            |
| `submitted_at`              | timestamptz | Set by `submit_leave_request`                                  |
| `forwarded_at`              | timestamptz | Set by `complete_leave_forwarding`                             |
| `cancelled_at`              | timestamptz | Set by `cancel_leave_request`                                  |
| `cancelled_by`              | uuid        | → `auth.users(id)`; who cancelled it                           |
| `cancellation_note`         | text        | Optional, 1–2000 chars; shown in the app and the CSV           |
| `ocr_status`                | text        | `not_run` / `pending` / `succeeded` / `failed` / `unsupported` |
| `ocr_provider`              | text        | Which reader produced the result                               |
| `ocr_result`                | jsonb       | The raw suggestion, never applied automatically                |
| `ocr_extracted_at`          | timestamptz |                                                                |
| `ocr_confirmed_at`          | timestamptz | Set when the student confirms the values                       |
| `field_sources`             | jsonb       | Per-field provenance: `manual` / `ocr` / `ocr_corrected`       |
| `created_at` / `updated_at` | timestamptz |                                                                |

`revision_count` and `last_review_note` were removed by the cancellation
migration. The notes themselves remain in `leave_request_history`.

### `leave_request_evidence`

| Column              | Type        | Notes                                                     |
| ------------------- | ----------- | --------------------------------------------------------- |
| `id`                | uuid PK     |                                                           |
| `request_id`        | uuid        | → `leave_requests(id)` ON DELETE CASCADE                  |
| `storage_path`      | text UNIQUE | `{student_id}/{request_id}/{uuid}-{filename}`             |
| `original_filename` | text        | Sanitised, display only                                   |
| `mime_type`         | text        | Whitelisted: `application/pdf`, `image/jpeg`, `image/png` |
| `file_size`         | int         | 1 … 10485760                                              |
| `sort_order`        | int         | Stable ordering for reports                               |
| `removed_at`        | timestamptz | Soft delete                                               |
| `removed_by`        | uuid        | Paired with `removed_at` by a check constraint            |

Rows are never hard-deleted, so an admin's earlier view of the evidence set
stays explainable. `(removed_at IS NULL) = (removed_by IS NULL)` prevents a
half-deleted row.

### `leave_request_history`

Append-only. `action` is constrained to `created`, `updated`, `submitted`,
`approved`, `rejected`, `cancelled`, `forwarded`, `evidence_added`,
`evidence_removed`, `ocr_recorded`.
The legacy `revision_requested` and `resubmitted` actions are still accepted so
old rows render, but nothing writes them any more. No UPDATE or DELETE is
granted to any client role, so a past submission cannot be rewritten.

### `leave_request_forwardings`

| Column             | Type        | Notes                                         |
| ------------------ | ----------- | --------------------------------------------- |
| `reference`        | text UNIQUE | `LF-…` package reference                      |
| `class_id`         | uuid        | → `classes(id)`                               |
| `forwarded_by`     | uuid        | → `profiles(id)`                              |
| `recipient_name`   | text        | The lecturer the package is addressed to      |
| `recipient_email`  | text        | Optional, recorded for the audit trail only   |
| `report_reference` | text        | Which file was produced                       |
| `report_format`    | text        | `summary` or `complete`                       |
| `request_count`    | int         | 1 … 200                                       |
| `idempotency_key`  | text UNIQUE | Makes a retried submit return the same record |

### `leave_request_forwarding_items`

One row per request per package, with a snapshot of the student's display name
and absence dates **at forwarding time**.

`UNIQUE (request_id)` is the structural guarantee that a request can belong to
at most one package. A second attempt to include it fails at the constraint
rather than relying on application logic.

---

## 4. Permissions

| Role            | Can do                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student (owner) | Create, edit while `draft`, upload/remove evidence, submit, cancel while pending, confirm OCR values, read their own request                                                       |
| Class admin     | Read every non-draft request in **their own** classes, read evidence, approve or reject a submitted request (not their own), cancel a submitted request, generate reports, forward |
| Class member    | Nothing beyond their own requests                                                                                                                                                  |
| Platform admin  | Same as class admin, across classes                                                                                                                                                |
| Anyone else     | Nothing; the request is invisible                                                                                                                                                  |

Predicates used by the policies and functions:

- `is_leave_request_owner(uuid)`
- `is_class_member(uuid)`, `is_class_admin(uuid)`, `can_manage_class(uuid)`
- `can_view_leave_request(uuid)` — owner, or a manager of its class
- `can_review_leave_request(uuid)` — a manager of its class who is **not** the
  owner. `review_leave_request` performs the same checks directly inside the
  transaction, so a caller cannot skip the predicate by calling the RPC.

A user cannot grant themselves class admin: `class_admins` has no client write
path, and `is_class_admin` reads a table only the class workflow functions write.

---

## 5. Evidence uploads and storage

**Bucket:** `leave-evidence`, private (`public = FALSE`), `file_size_limit`
10485760, `allowed_mime_types` `application/pdf`, `image/jpeg`, `image/png`.

**Upload path:**

1. The route checks `Content-Length` against the limit before reading the body.
2. `validateEvidenceFile` reads the bytes and checks the leading signature
   against the extension. **The declared MIME type is ignored** — a client can
   put anything in `Content-Type`.
3. The object is uploaded to `{student_id}/{request_id}/{uuid}-{filename}`. The
   key is generated server-side; the original filename only appears after a
   sanitising pass that strips directories.
4. `add_leave_request_evidence` creates the row. If it fails, the object is
   removed again so a rejected upload cannot leave an orphan in the bucket.
5. OCR runs best-effort afterwards. A reader failure never fails the upload.

**Reading:** `createSignedUrl(..., 300)` — five minutes. Shorter than the 15
minutes used for assignment attachments, because a leave document is medical
evidence. The storage policy only issues a URL to a caller allowed to read the
object, so an unauthorised caller gets `null` rather than a link.

**Removal:** soft delete first, then the object. If the object removal fails it
is logged, not thrown: the row is already unreachable through the app.

**What never leaves the server:** storage keys, bucket names, and signed URLs are
never written into a report, a CSV, a notification, or a log line.

### Size limit

The limit exists in two places and they must agree:

- `LEAVE_EVIDENCE_MAX_BYTES` in `packages/contracts/src/leave.ts` — what the
  application validates against.
- `file_size_limit` on the bucket in `20261029002400_leave_rls.sql` — what
  Storage enforces.

Changing one without the other produces either a confusing Storage rejection or
an upload the database refuses. Change both, then update the hint text in
`evidence-manager.tsx`.

---

## 6. OCR

Optional, and additive by design.

| Setting                 | Behaviour                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `OCR_PROVIDER` unset    | Defaults to `pdf-text`                                           |
| `OCR_PROVIDER=pdf-text` | Reads the PDF text layer with `unpdf`                            |
| `OCR_PROVIDER=disabled` | OCR off; every upload records `not_run` and the form works alone |
| Any unknown value       | Treated as disabled, so a typo cannot silently change behaviour  |

`NEXT_PUBLIC_FEATURE_OCR=false` is a separate module switch: it hides the reader
UI and answers `404` on the confirmation route. Uploads and manual entry work
exactly as before.

**What it extracts:** document issue date, leave start/end, student name,
document type. Month names in Indonesian and English are recognised, and both
`12/03/2026` (day-first) and `03/25/2026` (unambiguously month-first) parse.

**Outcomes** — all recorded on the request, none of them blocking:

| Status        | When                                               |
| ------------- | -------------------------------------------------- |
| `not_run`     | No document has been read yet                      |
| `succeeded`   | Text was extracted and parsed                      |
| `unsupported` | No text layer (a scan), a non-PDF, or OCR disabled |
| `failed`      | The file could not be read at all                  |

**Provenance.** `ocr_result` holds a _suggestion_. It is never written into the
request columns automatically. The student clicks "Use this value" per field,
and `field_sources` records whether that field is `manual`, `ocr`, or
`ocr_corrected`. The detail page shows the suggestion beside the confirmed
value so a reviewer can tell a guess from something the student checked.

**Never claimed:** that a document is genuine, that OCR text is proof, or that a
suggestion is a decision. `confidence` is capped at 0.9 — reading a document is
not verification.

**Manual entry is always available.** No state of the reader can block the
request workflow.

---

## 7. Forwarding

A class admin selects `submitted` requests and generates a package.

### Order of operations

1. Authorise the caller as a manager of the class in the URL.
2. Load the selection **scoped by class**, so a crafted id list cannot pull in
   another class's request.
3. Reject anything not `submitted`.
4. Build the report bytes.
5. Only then call `complete_leave_forwarding`, which re-checks everything inside
   a transaction and marks the requests `forwarded`.

Step 4 before step 5 matters: a generation failure cannot leave a request
falsely marked as forwarded. If the PDF cannot be built, the requests stay
`submitted`.

### Idempotency

- `idempotency_key` is `UNIQUE`. A retried submit with the same key returns the
  original `(id, reference, request_count)` instead of creating a second
  package. The client keeps the key across retries of the same attempt and
  rotates it after a success.
- `UNIQUE (request_id)` on the items table makes a duplicate inclusion
  impossible even if two different keys race.

### Partial failure

`complete_leave_forwarding` counts the selected rows and the eligible rows inside
the same transaction. A mismatch raises `SS013` and nothing is committed — there
is no state where half a package exists.

### What the admin is told

The success message says the file was **downloaded to your device**, that
StarsTask did not email it, and that the lecturer has not confirmed receipt.
Those three statements are accurate and stay separate in the UI copy.

### Retry, and the download-and-share path

There is no email infrastructure. Forwarding is deliberately
**download-and-share**: the server returns the PDF in the response body and the
browser saves it. The admin sends it to the lecturer by whatever channel the
institution uses. Nothing in the product claims a message was delivered.

---

## 8. Exports

All four are `GET /api/classes/[slug]/leave-requests/export?format=…`, require
class-manager rights, and are rate limited to 20 per minute.

Rows come from `listLeaveReportRows`, which returns every status after `draft`
(`submitted`, `approved`, `rejected`, `forwarded`, `cancelled`) for that one
class. Drafts never appear in a report, and the status column keeps a decision
separate from a forwarding hand-off.

### CSV (`format=csv`)

Columns: reference, student, absence start, absence end, day count, document
issue date, reason, submitted at, status, cancellation note.

- ISO dates (`2026-03-12`), so a spreadsheet cannot reinterpret them per locale.
- **Formula-injection guard:** a cell whose first character — or first
  non-whitespace character — is `=`, `+`, `-`, `@`, tab, or CR is prefixed with
  `'`. A student who names themselves `=cmd|...` cannot execute anything when an
  admin opens the file.
- RFC 4180 quoting, CRLF line endings, UTF-8 BOM so Excel reads it as UTF-8.
- No images, no signed URLs, no storage paths, no credentials.
- Filename built from a sanitised slug and validated dates only.

### Summary PDF (`format=summary`)

The table only. Built **without touching storage**, so it still works when a
document is unavailable or the bucket is misconfigured. A4, page numbers,
repeated table headers on each page, and a footer stating that the file records
the request and its status, not the evidence behind a decision.

### Complete PDF (`format=complete`)

The table, then the evidence:

- JPG/PNG are embedded as full pages, scaled by the tighter of the two ratios and
  centred — never cropped or stretched.
- A PDF attachment has its pages copied in as-is.
- Each attachment page is labelled with the request reference, the student's
  display name, and the original filename, so a page can always be traced back
  to its row.
- Multiple files per request are appended in `sort_order`.
- Only evidence for requests already in the report is appended; evidence for a
  request outside the selection cannot be attached by accident.

**Limitations, stated plainly:**

- Attachments follow the table, not interleaved per row.
- A password-protected or corrupt PDF, an unreadable image, or a file that
  cannot be downloaded is **never silently omitted**. It is listed on a final
  "Attachments not included" page with its reference and filename, and the page
  says the report is therefore not a complete evidence package.
- If nothing could be attached, a page says so explicitly.
- Very large documents are bounded by the platform's response size, not by the
  report code; a 200-request complete report with large scans may exceed it.

### ZIP (`format=zip`)

Summary PDF, `manifest.csv`, and the original files under reference-prefixed
entry names. Entry names are sanitised and prefixed with the request reference,
so two students' `surat.pdf` cannot collide and no entry can traverse out of the
archive. Files that could not be added are reported in the manifest and the
returned `missing` list.

The UI warns that the package contains medical information.

---

## 9. Notifications

Five kinds, all through the existing `enqueue_notification_event` ledger:

| Kind                      | Recipient                                                                                 | Dedupe key suffix      |
| ------------------------- | ----------------------------------------------------------------------------------------- | ---------------------- |
| `leave_request_submitted` | Class admins                                                                              | request id + timestamp |
| `leave_request_approved`  | The student                                                                               | request id + timestamp |
| `leave_request_rejected`  | The student                                                                               | request id + timestamp |
| `leave_request_forwarded` | The student                                                                               | forwarding id          |
| `leave_request_cancelled` | The other party: class admins when the student cancels, the student when an admin cancels | request id + timestamp |

Rules the payloads follow:

- Enqueued only **after** the state change succeeds. A rolled-back transaction
  leaves no notification.
- Dedupe keys make a retried request harmless; the ledger's unique key swallows
  the duplicate.
- The actor is excluded from their own notification.
- **No medical content.** The body never contains the explanation, the review
  note, the cancellation note, OCR text, a document name, or an evidence link —
  a push payload is visible on a lock screen. The decision note is read in the
  request history.
- Approval says that the absence was approved and that covered sessions are
  excused; it never says the student was present.

If the notification ledger or push is unconfigured, the workflow still completes;
only the notification is missing.

---

## 10. HTTP API

| Method   | Path                                                 | Who                  |
| -------- | ---------------------------------------------------- | -------------------- |
| `GET`    | `/api/leave-requests`                                | Student              |
| `POST`   | `/api/leave-requests`                                | Student              |
| `PATCH`  | `/api/leave-requests/[id]`                           | Owner                |
| `POST`   | `/api/leave-requests/[id]/submit`                    | Owner                |
| `POST`   | `/api/leave-requests/[id]/cancel`                    | Owner or class admin |
| `POST`   | `/api/leave-requests/[id]/evidence`                  | Owner                |
| `DELETE` | `/api/leave-requests/[id]/evidence/[evidenceId]`     | Owner                |
| `POST`   | `/api/leave-requests/[id]/ocr`                       | Owner                |
| `GET`    | `/api/classes/[slug]/leave-requests/export?format=…` | Class admin          |
| `POST`   | `/api/classes/[slug]/leave-requests/forward`         | Class admin          |
| `POST`   | `/api/classes/[slug]/leave-requests/[id]/review`     | Class admin          |

The forward route returns the PDF with three diagnostic headers:
`X-Starstask-Forwarding-Reference`, `X-Starstask-Request-Count`, and
`X-Starstask-Missing-Attachments`.

Error mapping (`apps/web/src/features/leave/errors.ts`):

| Postgres | HTTP | Code                 | Meaning                                   |
| -------- | ---- | -------------------- | ----------------------------------------- |
| `42501`  | 403  | `forbidden`          | Not allowed                               |
| `P0002`  | 404  | `not_found`          | Missing or invisible                      |
| `22023`  | 400  | `invalid_input`      | Bad value                                 |
| `SS011`  | 409  | `not_editable`       | No longer editable                        |
| `SS012`  | 409  | `invalid_transition` | Action not allowed in this state          |
| `SS013`  | 409  | `not_eligible`       | Selection has a request that is not ready |
| `SS014`  | 422  | `incomplete`         | Missing fields or no evidence             |
| `SS015`  | 409  | `invalid_selection`  | Malformed selection                       |

Unexpected database errors log the code and error class only — never the SQL
message, which can echo a row value.

---

## 11. UI

| Route                                              | Purpose                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `/leave-requests`                                  | The student's own absence requests                                 |
| `/leave-requests/new`                              | Create a draft (class picker if >1), attach evidence before saving |
| `/leave-requests/[id]`                             | Detail, evidence, history, OCR, review, cancel                     |
| `/leave-requests/[id]/edit`                        | Edit a draft                                                       |
| `/dashboard/classes/[slug]/leave-requests`         | Class request list, filters, exports                               |
| `/dashboard/classes/[slug]/leave-requests/forward` | Batch selection and forwarding                                     |
| `/dashboard/classes/[slug]/leave-requests/history` | Forwarding history                                                 |

Every page distinguishes loading, empty, filtered-empty, error, success, and
partial-failure states. On a submitted request the class admin sees **Approve
absence** and **Reject**, with an optional note. Forwarding remains a separate
action on the class list and forward page; it records a hand-off and does not
change the decision.

---

## 12. Configuration

| Variable       | Required | Notes                                            |
| -------------- | -------- | ------------------------------------------------ |
| `OCR_PROVIDER` | No       | `pdf-text` (default) or `disabled`. Server-only. |

Everything else is the standard StarsTask set (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`). The
service-role key is **not** needed by this feature: every read runs as the
caller, and every write goes through a `SECURITY DEFINER` function.

The bucket is created by the migration. No manual Storage setup is required, and
no bucket policy needs to be clicked together in the dashboard.

---

## 13. Local development and deployment

```bash
# 1. Apply the migrations (includes the bucket and its policies)
supabase db reset        # local
supabase db push         # remote

# 2. Regenerate types if you changed the schema (local Supabase must be running)
pnpm db:types

# 3. Run
pnpm dev
```

Order matters on a fresh project: `20261029002200` must run before
`20261029002300` (functions reference the tables), and
`20261029002400` creates the bucket the functions assume.

To disable OCR on a deployment, set `OCR_PROVIDER=disabled`. No other feature is
affected.

---

## 14. Troubleshooting

| Symptom                                            | Likely cause                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Upload fails with "does not look like a valid PDF" | The file was renamed. Validation reads the bytes, not the extension.                  |
| Upload fails with a Storage 413                    | The bucket's `file_size_limit` and `LEAVE_EVIDENCE_MAX_BYTES` disagree.               |
| "Open" shows "Unavailable"                         | The signed URL could not be created — usually the storage policy or a removed object. |
| Complete PDF says "Attachments not included"       | One or more files could not be downloaded or decoded. The page names each one.        |
| Forwarding returns `not_eligible`                  | A selected request is no longer `submitted`, or belongs to another class.             |
| Forwarding returns `conflict`                      | The request is already in another package (`UNIQUE (request_id)`).                    |
| Cancel returns `invalid_transition`                | The request is already forwarded or cancelled.                                        |
| Cancel returns 404 after deployment                | The environment is missing `20261030090000`; `cancel_leave_request` is absent.        |
| Review returns 404 after deployment                | The environment is missing `20261031170000`; `review_leave_request` is absent.        |
| Approve returns 409                                | The request is no longer `submitted` (already decided or withdrawn).                  |
| Approve returns 403                                | The caller does not manage the class, or is reviewing their own request.              |
| The class request list is empty                    | Drafts are excluded by design; the student has not submitted yet.                     |
| OCR never suggests anything                        | A scanned PDF has no text layer. `unsupported` is the expected outcome.               |

---

## 15. What is not verified

Stated plainly, because the difference matters:

- **The cancellation and review migrations are applied but unexercised.**
  `20261030090000` (cancellation) and `20261031170000` (review, approval,
  rejection) were applied to the live project on 2026-11-02. The functions
  exist; a real cancel/review request has not been driven through the UI.
- **The earlier migrations were executed only through `supabase db push`.**
  They parse cleanly (`pgsql-parser` accepts all files) and the push succeeded,
  but PL/pgSQL bodies are opaque to a parser, so the function logic was reviewed
  by hand rather than exercised.
- **RLS, storage policies, signed URLs, and the `SECURITY DEFINER` functions
  have never been exercised against Postgres** in this environment.
- **No end-to-end flow was driven through a browser.** The pages render and the
  routes are registered by `next build`, but creating a request, uploading a
  file, cancelling, and forwarding a package has not been clicked through.
- **Unit tests cover the pure parts:** CSV escaping and formula injection, date
  formatting, OCR parsing, evidence validation, PDF report integrity (every row
  in the table, attachments traceable by reference, missing files reported), the
  forwarding payload schema, the cancellation schema, and the review schema
  (decisions, note limits, stripped status). They do not cover SQL,
  RLS, or the network
  calls to Storage.
