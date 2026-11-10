# Leave Requests (native Android)

Student Leave Requests for Android, implemented against the existing web
backend. The web application remains the source of truth for business logic;
this module is a native presentation layer over the same Supabase project.

## Web audit summary

Source of truth: `docs/LEAVE_REQUESTS.md`, `packages/contracts/src/leave.ts`,
`apps/web/src/lib/db/leave.ts`, `apps/web/src/features/leave/leave-service.ts`,
and the migrations under `supabase/migrations/20261029*_leave_*`,
`20261030*_absence_cancellation.sql`, `20261031*_absence_review_attendance.sql`,
`20261104*_leave_revision_flow.sql`.

### Statuses and transitions

| Backend status | UI label | Meaning |
| --- | --- | --- |
| `draft` | Draft | Half-filled, private to the student. |
| `submitted` | Pending | Sent to the class admin for a decision. |
| `approved` | Approved | Class admin approved. Covered sessions become `excused`, never `present`. |
| `rejected` | Rejected | Class admin rejected. Attendance unchanged. |
| `forwarded` | Forwarded | Included in a class admin's forwarding package. **Not a decision.** |
| `cancelled` | Cancelled | Withdrawn by the student, or cancelled by the class admin. |
| `revision_requested` | Revision Requested | Returned for edit and resubmit. |
| `needs_revision` | Pending | Legacy rows pre-migration; mapped to `submitted` like the web data layer. |

Transitions: `draft → submitted` (submit); `submitted → approved/rejected`
(class admin review); `submitted → revision_requested` (class admin);
`draft/submitted/revision_requested → cancelled`; `submitted → forwarded`
(class admin package only, via `complete_leave_forwarding`). `approved`,
`rejected`, `forwarded`, and `cancelled` are terminal. There is no hard
delete; cancelling is the withdrawal action.

Forwarded therefore never counts as approved: the statistics grid counts only
`submitted`, `approved`, `rejected`, and `draft`, exactly like the web
`countLeaveRequestsByStatus`.

### Fields and validation (all mirrored in `data/LeaveRequestActions.kt`)

- Class (required; picker only when the student has more than one).
- Covered courses (`subject_ids`, up to 20; required on submit when the class
  has active courses).
- Leave start/end dates (required on submit; end on/after start; at most 365
  days).
- Document issue date (optional; shown separately from the leave dates).
- Reason: `illness` / `family_matter` / `other` (required on submit).
- Explanation: 10–4000 characters on submit.
- Evidence: PDF/JPG/PNG, at most 10 MB each, at most 10 files, at least one
  on submit. Type is checked by extension **and** magic bytes, never by the
  declared MIME type.

### Permissions

- Student (owner): create, edit while `draft`/`revision_requested`, upload or
  remove evidence while editable, submit, cancel while `draft`/`submitted`/
  `revision_requested`, read their own requests, evidence, and history.
- Class admin: review (`approved`/`rejected`/`revision_requested`), forward,
  export — these stay on the web workspace; the native module is the
  student surface and never calls the review RPC.

Authorization is enforced server-side: every write is a `SECURITY DEFINER`
RPC (`create_leave_request`, `update_leave_request`,
`set_leave_request_subjects`, `submit_leave_request`,
`cancel_leave_request`, `add_leave_request_evidence`,
`remove_leave_request_evidence`) that derives the student from the auth
session. No user id is sent by the client, and there is no client-writable
status column. Notifications are enqueued inside those functions, so native
writes notify exactly like web writes.

### Terminology mapping (presentation layer only)

UI: Absence Requests → **Leave Requests**, New Request → **New Leave
Request**, Absence → **Leave** (bottom-tab label). Backend tables, columns
(`leave_start_date`, …), RPC names, and status values are unchanged.

## What was implemented

- `data/LeaveRequests.kt` — read models, status/reason labels, date helpers,
  list/detail/evidence/history/class+course loaders (class names, evidence
  counts, subject names enriched in bulk, no per-row queries).
- `data/LeaveRequestActions.kt` — RPC mutations, evidence upload with
  storage rollback on failure, 5-minute signed URLs, client-side mirrors of
  the web validation rules, safe error mapping (Postgres codes → friendly
  messages, SQL never surfaced).
- `ui/screens/LeaveRequestsScreens.kt` — header, New Leave Request action,
  Pending/Approved/Rejected/Draft statistics from real data, Your Requests
  list with status filters + search, empty state, forwarded explainer,
  pull-to-refresh.
- `ui/screens/LeaveRequestDetailScreen.kt` — decision/submitted banners,
  three-dates note, evidence with signed-URL open, append-only history,
  edit/submit/cancel respecting status eligibility, plus the class-admin
  review card (approve/reject/return for revision with the web note rule)
  and admin cancel for submitted requests.
- `ui/screens/LeaveRequestFormScreen.kt` — native form with date pickers and
  the system file picker; must-cover courses, document issue date, save-draft
  and submit paths upload staged files before submitting so a failed upload
  never silently drops evidence.
- `ui/screens/ClassReportsLeaveScreens.kt` — class-admin queue: enriched
  rows (student, reference, dates, reason, courses, evidence count,
  explanation), approve/reject/revision with note validation, tap-through to
  the shared detail screen (evidence + history + review), forwarding history
  (packages newest-first with recipient/format/count + per-request snapshot
  items, mirroring web `listLeaveForwardings`), and a shareable CSV report
  mirroring the web export (columns + formula-injection guard).
- Bottom navigation: the shared bar's fifth destination is now **Leave**
  (the page title stays Leave Requests). Navigation state is preserved.
- Forwarding **generation** stays web-only by architecture, verified against
  `apps/web/src/features/leave/forwarding-service.ts`: the package bytes
  (summary/complete PDFs built from evidence downloads) are generated on the
  Next.js server **first**, and only then is
  `complete_leave_forwarding(p_class_id, p_request_ids, p_recipient_name,
  p_recipient_email, p_report_reference, p_report_format,
  p_idempotency_key)` called — "a generation failure cannot leave a request
  falsely marked as forwarded". The native shell has no report-PDF generator
  and no reachable Next.js route, so calling the RPC directly would record a
  forwarding without any package existing. Until a mobile API route exists,
  admins generate packages on the web; the native app reads the resulting
  history and shows `forwarded` status accurately.
- Student list filters mirror the web `LeaveFilters` (status + reference/
  class search) applied over the newest 100 own requests; web server-side
  date-range filtering and pagination stay web-only is not simulated.

## Deliberate limitations

- **OCR / Document Reader extraction is not replicated** (server-side after
  web uploads). The native equivalent is limited to what the web contract
  allows the owner to do directly: the detail screen reads
  `ocr_status`/`ocr_result`/`field_sources`, shows each suggestion with its
  provenance (`manual`/`ocr`/`ocr_corrected`), and records confirmation via
  `confirm_leave_request_ocr`. Manual entry is always available, which the
  web form also guarantees. Nothing in the native UI claims a document was
  read or verified.
- **Class-admin review, forwarding, and exports stay on the web.** They are
  class-admin surfaces (`/dashboard/classes/[slug]/leave-requests/*`); the
  student app does not call `review_leave_request` or the forward route.
- **No request filters or pagination on mobile** beyond the newest 100 own
  requests, matching the existing native list scope.

## What is implemented (final)

Student surface (`LeaveRequestsScreen` and friends): list with statistics,
status filters + search, create/edit form with class, covered courses, leave
period, document issue date, reason, explanation, evidence upload, save
draft and submit; detail with decision/submitted banners, three-dates note,
evidence (signed 5-minute URLs), append-only history, edit/submit/cancel
gated to the owner, and the class-admin review card (approve/reject/return
for revision with the web note rule) plus admin cancel for submitted
requests. Admin queue (`ClassLeaveScreen`): enriched non-draft rows,
approve/reject/revision with note validation, tap-through to the shared
detail screen, and a shareable CSV report mirroring the web export
(columns + formula-injection guard).

Web-only by design (needs the Next.js server routes, not available to the
native shell): forwarding-package generation (summary/complete PDFs, ZIP),
forwarding history page, OCR document reading and suggestion confirm, and
server-side date-range filtering/pagination (native list shows the newest
100 own requests client-side).
