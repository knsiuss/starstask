# Manual Attendance SOP (GPS Failure)

When a student is physically in the room but GPS check-in fails
(inaccurate, stale, unavailable, timeout, or outside radius), the
attendance is recorded manually by the class admin. Offline check-in
is not used: timestamps and positions come from the student's device
and cannot be trusted after the fact.

## Student

1. Try once more near a window or outdoors.
2. If it still fails, report to the class admin in the room. Show the
   error message on screen. Do not leave before the admin records it.

## Class admin

1. Physically verify the student is in the room and within the allowed
   area. Never mark a student present from a chat or photo alone.
2. Open the meeting attendance page and use **Correct** on the
   student's row (or **mark present** in the attendance sheet for
   several students at once).
3. Set the status to Present (or Late) and always write a reason, for
   example: `Student in room; GPS accuracy too poor`.
4. For Present, tick the physical-verification attestation. The server
   rejects the correction without it.

## Audit trail

Every manual correction is stored with the previous status, new
status, admin name, and reason. It is listed in the meeting's
correction history and in the recap workbook's Correction Audit
sheet. The correction is recorded as `manual`, never as a GPS
check-in, so it is never mistaken for a geo check-in.

## Approved leave (auto-excused)

When an absence request is approved, the matching sessions are
marked excused automatically — including sessions created after the
approval, which a database trigger excuses on creation. The student
does not need to check in for those meetings, and the admin does not
need to record them one by one. A session the student already
checked in to (present/late) is never overwritten.

## Limits

- A student who is genuinely absent or outside the area must not be
  marked present.
- Manual correction is for technical GPS failures only, not for
  backdating attendance after the meeting has closed without a
  verified reason.
