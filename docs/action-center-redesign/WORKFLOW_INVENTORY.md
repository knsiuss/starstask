# Action Center Workflow Inventory

Last updated: 2026-11-04

## Assignment publications

- Lifecycle: `pending → approved | rejected | revision_requested`
- Actors: class admin of the request's class.
- Actions: approve, reject (with reason), request revision, open assignment.
- Evidence: assignment content, attachments.

## Absence requests

- Lifecycle: `submitted → approved | rejected | revision_requested | forwarded | cancelled`
- Actors: class admin.
- Actions: approve, reject (with reason), forward to lecturer package; view evidence images/PDFs; view affected sessions.
- Important semantics:
  - Forwarded ≠ approved.
  - Forwarded does not prove the lecturer has read the request.
  - Saved evidence is signed via `getEvidenceViews`.

## Attendance

- Not a request lifecycle. Sessions are `scheduled → open → closed → finalized`.
- Metrics are per-course counts from `class_attendance_meeting_list` RPC.
- Export is the existing per-course recap workbook.

## Open reports

- Count appears in Overview and sidebar. Opening goes to `/dashboard/classes/[slug]/reports`.

## Authorization

- Only classes where the user is `is_admin` and status is `active` are included in the action center (`selectActionCenterClasses`).
- The page re-checks class roles through `getWorkspaceScope` and RLS.
- Forwarding and approval use the existing `LeaveReviewActions` / route guards.
