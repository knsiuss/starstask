import { describe, expect, it } from "vitest";

import {
  SHEET_CODES,
  SHEET_STATUSES,
  sheetPercentage,
  sheetTotals,
} from "@/lib/attendance/sheet-codes";
import { buildAttendanceRecap } from "@/lib/attendance/recap";
import {
  attendanceMeetingCheckInSchema,
  attendanceMeetingCorrectionSchema,
} from "@starstask/contracts";

describe("attendance sheet codes", () => {
  it("uses text codes in reference order", () => {
    expect(SHEET_STATUSES).toEqual([
      "present",
      "excused",
      "sick",
      "absent",
      "late",
    ]);
    expect(SHEET_CODES).toEqual({
      present: "✓",
      excused: "I",
      sick: "S",
      absent: "A",
      late: "T",
    });
  });

  it("computes the reference percentage as present over total meetings", () => {
    expect(sheetPercentage(15, 16)).toBe(93.8);
    expect(sheetPercentage(0, 0)).toBeNull();
  });

  it("counts each status and ignores view states", () => {
    const totals = sheetTotals({
      s1: "present",
      s2: "sick",
      s3: "late",
      s4: "not_recorded",
      s5: "not_applicable",
    } as never);

    expect(totals).toEqual({
      present: 1,
      excused: 0,
      sick: 1,
      absent: 0,
      late: 1,
    });
  });
});

describe("sick status plumbing", () => {
  it("accepts sick in the correction schema", () => {
    const parsed = attendanceMeetingCorrectionSchema.safeParse({
      userId: "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f",
      status: "sick",
      reason: "Student reported sick with a note",
      physicallyVerified: false,
    });

    expect(parsed.success).toBe(true);
  });

  it("still requires physical verification for present", () => {
    const parsed = attendanceMeetingCorrectionSchema.safeParse({
      userId: "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f",
      status: "present",
      reason: "Seen in the room",
      physicallyVerified: false,
    });

    expect(parsed.success).toBe(false);
  });

  it("counts sick separately in the recap matrix", () => {
    const recap = buildAttendanceRecap({
      meetings: [
        {
          sessionId: "s1",
          subjectId: "sub",
          subjectName: "Course",
          subjectCode: null,
          meetingNumber: 1,
          meetingDate: "2026-02-10",
          title: "Meeting 1",
          location: null,
          startsAt: "2026-02-10T08:00:00+07:00",
          endsAt: "2026-02-10T10:00:00+07:00",
          opensAt: null,
          closesAt: null,
          openedAt: "2026-02-10T07:50:00+07:00",
          closedAt: null,
          finalizedAt: null,
          radiusM: 100,
          lateAfterMinutes: 10,
          phase: "open",
          counts: {
            expected: 1,
            present: 0,
            late: 0,
            excused: 0,
            sick: 1,
            absent: 0,
            notRecorded: 0,
            failed: 0,
          },
        },
      ],
      roster: [
        {
          userId: "u1",
          fullName: "Test Student",
          nim: "IF230001",
          displayName: null,
          joinedAt: "2026-01-01T00:00:00+07:00",
        },
      ],
      cells: [
        { sessionId: "s1", userId: "u1", eligible: true, status: "sick" },
      ],
    });

    expect(recap.students[0]?.totals.sick).toBe(1);
    expect(recap.students[0]?.totals.present).toBe(0);
    // Sick is excluded from the policy denominator like excused.
    expect(recap.students[0]?.totals.eligible).toBe(0);
  });

  it("check-in schema still accepts a fresh reading", () => {
    expect(
      attendanceMeetingCheckInSchema.safeParse({
        fullName: "Test Student",
        nim: "21120123120001",
        latitude: -6.36,
        longitude: 106.83,
        accuracy: 20,
        capturedAt: Date.now(),
      }).success,
    ).toBe(true);
  });
});
