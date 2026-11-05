# 5I-E — Normalized Attendance

**Status: COMPLETE** (read/create/record/correct shipped; export intentionally not implemented; legacy path untouched)

## What shipped

| File                                                                           | Role                                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `apps/web/src/lib/db/academic-attendance.ts`                                   | Service-role reads/writes with explicit tenant filters + audit                           |
| `apps/web/src/app/api/classes/[slug]/academic/attendance/meetings/route.ts`    | Create meeting — `manage_attendance`                                                     |
| `apps/web/src/app/api/classes/[slug]/academic/attendance/records/route.ts`     | Bulk record (enrolled identities only; rest reported as `skipped`) — `manage_attendance` |
| `apps/web/src/app/api/classes/[slug]/academic/attendance/corrections/route.ts` | Correct a record — `manage_attendance`; append-only ledger first                         |
| `academic/attendance/page.tsx`                                                 | Manager UI: offerings → meetings → roster board → records + corrections history          |
| `components/academic/attendance-*.tsx`                                         | Meeting form, roster grid (present/late/excused/sick/absent), inline correction form     |

## Verification of inputs (pre-design)

- `has_class_permission(class_id, permission)` exists and is granted to `authenticated`; `manage_attendance` is one of the 8 fixed codes.
- New `attendance_meetings` / `attendance_records` / `attendance_corrections` tables: SELECT-only RLS for members; **zero client write policies**; only `platform_upsert_student_identity`-style definer path would bypass — none exists for attendance, so writes use service-role AFTER the caller is authorized.
- Statuses written match the schema CHECK constraint exactly: `present | late | excused | sick | absent` (`not_applicable` is display-only and never stored).
- Corrections: `attendance_corrections_reason_length` (3–2000) enforced in Zod **and** DB; previous status copied into the ledger before the record is updated; the ledger is append-only (no UPDATE/DELETE grants).
- Records upsert on `(meeting_id, student_identity_id)`; identities not actively enrolled in the offering are **skipped and reported**, never written.
- Tenant re-validation on every service-role call: meeting → offering → class → `university_id` must match the class the caller was authorized against; cross-class/cross-university rows return `not_found`.

## Audit trail

Every service-role mutation writes an `audit_logs` row (`attendance_meeting_created`, `attendance_records_upserted`, `attendance_record_corrected`) with `university_id` set (column added in 5G hardening; handwritten `database.ts` insert type extended — one-line additive change).

## Not implemented (deliberately)

- **Excel/PDF export** for the new model: no sanctioned export path exists for these tables (legacy exports use `discussion_sessions`-era RPCs). Adding one would invent a new surface; tracked as a follow-up. The legacy attendance export architecture is untouched.
- **CSV/Excel import:** explicitly out of scope by instruction; nothing importable exists.
- Student self-view of new-model attendance: not requested; legacy absence UX remains.
- Reminders/notifications on new meetings: reuses outbox only for legacy flows; no new pipeline built.

## Schema untouched

No migration, no RLS change, no function change. `20261115000000_ops.sql` and all prior migrations unmodified.

## Known gap

Attendance UI requires a linked class; tenant-unlinked classes get the standard unlinked notice. Empty in all current environments until platform activation.
