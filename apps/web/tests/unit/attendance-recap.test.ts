import { describe, expect, it } from "vitest";

import { buildAttendanceRecap } from "@/lib/attendance/recap";
import type {
  AttendanceMeetingListItem,
  AttendanceRosterMember,
} from "@/lib/attendance/meeting-types";

function meeting(
  overrides: Partial<AttendanceMeetingListItem> &
    Pick<AttendanceMeetingListItem, "sessionId" | "meetingNumber">,
): AttendanceMeetingListItem {
  return {
    subjectId: "subject-1",
    subjectName: "Interaksi Manusia dan Komputer",
    subjectCode: "IMK",
    meetingDate: "2026-11-02",
    title: "Meeting",
    location: "Room 3.04",
    startsAt: "2026-11-02T08:00:00+07:00",
    endsAt: "2026-11-02T10:00:00+07:00",
    opensAt: "2026-11-02T08:00:00+07:00",
    closesAt: "2026-11-02T10:00:00+07:00",
    openedAt: "2026-11-02T08:00:00+07:00",
    closedAt: "2026-11-02T10:00:00+07:00",
    finalizedAt: "2026-11-02T10:05:00+07:00",
    radiusM: 100,
    lateAfterMinutes: 10,
    phase: "finalized",
    counts: {
      expected: 3,
      present: 1,
      late: 0,
      excused: 0,
      sick: 0,
      absent: 1,
      notRecorded: 1,
      failed: 0,
    },
    ...overrides,
  };
}

const roster: AttendanceRosterMember[] = [
  {
    userId: "user-budi",
    fullName: "Budi Santoso",
    nim: "21120102",
    displayName: "Budi",
    joinedAt: "2026-08-01T00:00:00+07:00",
  },
  {
    userId: "user-ani",
    fullName: "Ani Wijaya",
    nim: "21120104",
    displayName: "Ani",
    joinedAt: "2026-08-01T00:00:00+07:00",
  },
  {
    userId: "user-citra",
    fullName: "Citra Amelia",
    nim: "21120103",
    displayName: "Citra",
    joinedAt: "2026-10-15T00:00:00+07:00",
  },
];

describe("buildAttendanceRecap", () => {
  it("sorts meetings by number and students by full name", () => {
    const recap = buildAttendanceRecap({
      meetings: [
        meeting({ sessionId: "s3", meetingNumber: 3, phase: "open" }),
        meeting({ sessionId: "s1", meetingNumber: 1 }),
      ],
      roster,
      cells: [],
    });

    expect(recap.meetings.map((entry) => entry.sessionId)).toEqual([
      "s1",
      "s3",
    ]);
    expect(recap.students.map((entry) => entry.fullName)).toEqual([
      "Ani Wijaya",
      "Budi Santoso",
      "Citra Amelia",
    ]);
  });

  it("keeps not recorded distinct from absent and excuse out of the denominator", () => {
    const recap = buildAttendanceRecap({
      meetings: [
        meeting({ sessionId: "s1", meetingNumber: 1 }),
        meeting({
          sessionId: "s2",
          meetingNumber: 2,
          phase: "open",
          openedAt: "2026-11-09T08:00:00+07:00",
          closedAt: null,
          finalizedAt: null,
        }),
      ],
      roster,
      cells: [
        {
          sessionId: "s1",
          userId: "user-budi",
          eligible: true,
          status: "present",
        },
        {
          sessionId: "s2",
          userId: "user-budi",
          eligible: true,
          status: "excused",
        },
        {
          sessionId: "s1",
          userId: "user-ani",
          eligible: true,
          status: "absent",
        },
        {
          sessionId: "s2",
          userId: "user-ani",
          eligible: true,
          status: "not_recorded",
        },
      ],
    });

    const budi = recap.students.find((entry) => entry.userId === "user-budi");
    const ani = recap.students.find((entry) => entry.userId === "user-ani");

    expect(budi?.cells.s1).toBe("present");
    expect(budi?.cells.s2).toBe("excused");
    expect(budi?.totals).toMatchObject({
      present: 1,
      late: 0,
      excused: 1,
      absent: 0,
      notRecorded: 0,
      attended: 1,
      eligible: 1,
      percentage: 100,
    });

    expect(ani?.cells.s1).toBe("absent");
    expect(ani?.cells.s2).toBe("not_recorded");
    expect(ani?.totals).toMatchObject({
      present: 0,
      absent: 1,
      notRecorded: 1,
      eligible: 2,
      percentage: 0,
    });
  });

  it("excludes a meeting that was never opened from the matrix totals", () => {
    const recap = buildAttendanceRecap({
      meetings: [
        meeting({ sessionId: "s1", meetingNumber: 1 }),
        meeting({
          sessionId: "s2",
          meetingNumber: 2,
          phase: "scheduled",
          openedAt: null,
          closedAt: null,
          finalizedAt: null,
        }),
      ],
      roster,
      cells: [
        {
          sessionId: "s1",
          userId: "user-ani",
          eligible: true,
          status: "absent",
        },
      ],
    });

    const ani = recap.students.find((entry) => entry.userId === "user-ani");

    expect(recap.meetings[1]?.opened).toBe(false);
    expect(ani?.cells.s2).toBe("not_applicable");
    expect(ani?.totals.eligible).toBe(1);
    expect(ani?.totals.absent).toBe(1);
    expect(ani?.totals.notRecorded).toBe(0);
  });

  it("marks a late joiner not applicable instead of absent", () => {
    const recap = buildAttendanceRecap({
      meetings: [meeting({ sessionId: "s1", meetingNumber: 1 })],
      roster,
      cells: [
        {
          sessionId: "s1",
          userId: "user-citra",
          eligible: false,
          status: "absent",
        },
      ],
    });

    const citra = recap.students.find((entry) => entry.userId === "user-citra");

    expect(citra?.cells.s1).toBe("not_applicable");
    expect(citra?.totals.absent).toBe(0);
    expect(citra?.totals.eligible).toBe(0);
    expect(citra?.totals.percentage).toBeNull();
  });

  it("excludes a class member with no cell for this subject (e.g. a repeat student)", () => {
    const repeatStudent: AttendanceRosterMember = {
      userId: "user-dodi",
      fullName: "Dodi Repeat",
      nim: "21120105",
      displayName: "Dodi",
      joinedAt: "2026-08-01T00:00:00+07:00",
    };

    const recap = buildAttendanceRecap({
      meetings: [meeting({ sessionId: "s1", meetingNumber: 1 })],
      roster: [...roster, repeatStudent],
      cells: [
        {
          sessionId: "s1",
          userId: "user-budi",
          eligible: true,
          status: "present",
        },
        {
          sessionId: "s1",
          userId: "user-ani",
          eligible: true,
          status: "absent",
        },
      ],
    });

    expect(recap.students.map((entry) => entry.userId)).not.toContain(
      "user-dodi",
    );
    expect(recap.students.map((entry) => entry.userId)).toContain("user-budi");
  });

  it("treats an unknown stored status as not recorded rather than present", () => {
    const recap = buildAttendanceRecap({
      meetings: [meeting({ sessionId: "s1", meetingNumber: 1 })],
      roster: roster.slice(0, 1),
      cells: [
        {
          sessionId: "s1",
          userId: "user-budi",
          eligible: true,
          status: "something-new",
        },
      ],
    });

    expect(recap.students[0]?.cells.s1).toBe("not_recorded");
    expect(recap.students[0]?.totals.present).toBe(0);
  });
});
