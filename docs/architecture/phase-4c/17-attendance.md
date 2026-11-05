# 17 — Domain K: Attendance

> **Status:** DRAFT. **CONFIRMED** = in-app only, per meeting + enrollment, admin records, corrections keep history, export Excel/PDF. Statuses below are VERIFIED from migrations (superseding the earlier "candidate-only" caution where evidence now exists).

## 17.1 Statuses — VERIFIED (not candidates)

- Repair migration `20261107000000_attendance_sick_status.sql` VERIFIED text: "The sheet needs five recorded statuses (present/late/excused/sick/absent)."
- `discussion_session_checkins_status_allowed CHECK (status IN ('present','late','excused','sick','absent'))` (VERIFIED).
- `record_discussion_session_checkin()` allowlist matches: `('present','late','excused','sick','absent')` — unknown status raises `22023` (VERIFIED in `20261101090000_attendance_meetings.sql`).
- Attendance sheet summary counts all five (`present_count/late_count/excused_count/sick_count/absent_count`, VERIFIED `20261107000000`).
- `class_attendance_recap()` comment (VERIFIED): "late joiners are marked not_applicable, never absent" — `not_applicable` is a **display/derived marker**, not a stored status (counted outside the five).
- Earlier brief note "statuses as candidates only" is now superseded by this migration evidence; remaining UNRESOLVED is only whether `late` vs `present` threshold is defined (see §17.4).

## 17.2 One table vs multiple lifecycle tables — evaluation

| Option                                                                                                                                                                                                                      | Verdict                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One table** (`discussion_session_checkins` holds everything)                                                                                                                                                              | Rejected: meeting lifecycle (scheduled/open/closed/cancelled), record lifecycle (present→corrected), and attempt audit (geo/identity) have independent transitions and retention. |
| **Multiple lifecycle tables (RECOMMENDED):** `attendance_meetings` (container lifecycle) + `attendance_records` (per-enrollment rows) + `attendance_corrections` (append-only) + `attendance_verification_attempts` (audit) | Chosen — matches the CONFIRMED requirements (per-meeting + enrollment, admin records, history-preserving corrections, export) and the existing audit-table pattern.               |

- Existing `discussion_sessions` doubles as meeting container via trigger `discussion_sessions_fill_attendance_meeting` (BEFORE INSERT, VERIFIED `20261101090000`). Target SPLITs meetings out of sessions (see `26`), keeping sessions for discussion purposes.
- Meetings reference **offerings** in the target (`attendance_meetings.offering_id`), fixing the current implicit course scope (session→class only) — see `04` §4.4.

## 17.3 Required behaviors

1. **In-app only, no Excel import (CONFIRMED)** — attendance is recorded in-app; Excel/PDF is **export-only** (see §17.6).
2. **Per course meeting + enrollment (CONFIRMED):** one `attendance_records` row per `(meeting, student)`; late joiners excluded from denominator (`record_discussion_session_checkin` VERIFIED comment: "A manual record cannot invent attendance for somebody who joined after the meeting").
3. **Admin records (CONFIRMED):** manual `record_*` RPCs gated by `can_organize_class_sessions()` / `can_manage_class()` (VERIFIED in attendance migration).
4. **Corrections keep history (CONFIRMED):** corrections are append-only rows in `attendance_corrections` (existing `attendance_correction_audits`, VERIFIED table); records are never updated in place.
5. **Self check-in (VERIFIED):** `check_in_attendance_meeting()` verifies window/accuracy/distance/class membership; already-checked-in returns existing row (idempotent, VERIFIED).
6. **Identity/GPS verification (VERIFIED):** `attendance_verification_attempts` logs failed+successful attempts; read only via `attendance_meeting_failures()` RPC; no typed name/NIM stored (VERIFIED comment).

## 17.4 Corrections history + summaries

- Correction rows carry `(record_id, previous_status, new_status, reason, corrected_by, corrected_at)` with CHECKs on both statuses (VERIFIED `20261107000000`).
- Summary RPCs VERIFIED: `class_attendance_meeting_list`, `class_attendance_member_summary`, `class_attendance_recap`, `class_attendance_roster`, `class_attendance_session_summary`, `attendance_meeting_roster`, `attendance_correction_audit_list`, `attendance_meeting_failures`.
- **UNRESOLVED (new):** `late` threshold definition (arrive-after minutes) — no threshold constant found in checked migrations. Phase 5A to search for it; RECOMMENDED default: meeting `late_after_min` column (PROPOSED, needs owner sign-off).

## 17.5 Export

- **VERIFIED:** `apps/web/src/features/attendance-meetings/excel.ts` (34 KB), `pdf.ts`, `exports.ts` exist; five-status counts map directly to sheet columns (see `20261107000000` summary query). Export applies the same RLS as reads (AGENTS.md §7.1).
- RECOMMENDED: export reads from `attendance_records` joined to meetings/offerings; derived `not_applicable` rendered as blank/NA marker.

## 17.6 Target schema (see `26` §26.1)

- `attendance_meetings(id, offering_id, university_id, scheduled_at, status scheduled/open/closed/cancelled, location, created_by, ...)` — NEW.
- `attendance_records(id, meeting_id, student_identity_id, status CHECK five values, recorded_by, recorded_at, note)` — RENAME of `discussion_session_checkins` + offering linkage; UNIQUE `(meeting_id, student_identity_id)`.
- `attendance_corrections(id, record_id, previous_status, new_status, reason, corrected_by, corrected_at)` — RENAME of `attendance_correction_audits`, append-only.
- `attendance_verification_attempts` — KEEP (audit; possibly re-pointed to meetings).

**Cross-refs:** `06`, `12`, `13`, `15` (manage_attendance), `19` (schedule — meetings vs rule instances), `23` (TENANT_DERIVED), `26` §26.1, `36` items 5/6.
