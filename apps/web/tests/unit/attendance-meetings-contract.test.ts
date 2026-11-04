import { describe, expect, it } from "vitest";

import {
  attendanceMeetingCheckInSchema,
  attendanceMeetingCloseSchema,
  attendanceMeetingCorrectionSchema,
  attendanceMeetingCreateSchema,
  attendanceMeetingLocationChangeSchema,
  getAttendanceLateDeadline,
  resolveAttendanceMeetingPhase,
} from "@starstask/contracts";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const SUBJECT_ID = "22222222-2222-4222-8222-222222222222";

const baseMeeting = {
  classId: CLASS_ID,
  subjectId: SUBJECT_ID,
  meetingNumber: 1,
  meetingDate: "2026-11-02",
  startsAt: "2026-11-02T08:00:00+07:00",
  endsAt: "2026-11-02T10:00:00+07:00",
  location: "Room 3.04",
  latitude: -6.3608,
  longitude: 106.8272,
};

describe("attendanceMeetingCreateSchema", () => {
  it("applies the late deadline and radius defaults", () => {
    const parsed = attendanceMeetingCreateSchema.parse(baseMeeting);

    expect(parsed.lateAfterMinutes).toBe(10);
    expect(parsed.radiusM).toBe(200);
    expect(parsed.title).toBeUndefined();
  });

  it("accepts a complete meeting with an attendance window", () => {
    const parsed = attendanceMeetingCreateSchema.parse({
      ...baseMeeting,
      meetingNumber: "3",
      opensAt: "2026-11-02T07:45:00+07:00",
      closesAt: "2026-11-02T09:30:00+07:00",
      lateAfterMinutes: "15",
      radiusM: "200",
      title: "  Review session  ",
    });

    expect(parsed.meetingNumber).toBe(3);
    expect(parsed.lateAfterMinutes).toBe(15);
    expect(parsed.radiusM).toBe(200);
    expect(parsed.title).toBe("Review session");
  });

  it("rejects an end that is not after the start", () => {
    const parsed = attendanceMeetingCreateSchema.safeParse({
      ...baseMeeting,
      endsAt: "2026-11-02T08:00:00+07:00",
    });

    if (parsed.success) {
      throw new Error("Expected the meeting window to be rejected");
    }

    expect(parsed.error.issues[0]?.path).toEqual(["endsAt"]);
  });

  it("rejects a meeting longer than 24 hours", () => {
    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        endsAt: "2026-11-03T09:00:00+07:00",
      }).success,
    ).toBe(false);
  });

  it("rejects an attendance window that closes before it opens", () => {
    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        opensAt: "2026-11-02T09:00:00+07:00",
        closesAt: "2026-11-02T08:00:00+07:00",
      }).success,
    ).toBe(false);
  });

  it("requires both coordinates or neither", () => {
    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        longitude: undefined,
      }).success,
    ).toBe(false);

    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        latitude: null,
        longitude: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a radius outside the supported range", () => {
    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        radiusM: 20,
      }).success,
    ).toBe(false);

    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        radiusM: 501,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields so the client cannot smuggle another class", () => {
    expect(
      attendanceMeetingCreateSchema.safeParse({
        ...baseMeeting,
        organizerId: CLASS_ID,
      }).success,
    ).toBe(false);
  });
});

describe("attendanceMeetingCheckInSchema", () => {
  const valid = {
    fullName: "Ayu Lestari",
    nim: "21120123120001",
    latitude: -6.3608,
    longitude: 106.8272,
    accuracy: 25,
  };

  it("accepts a precise reading at the accuracy ceiling", () => {
    expect(
      attendanceMeetingCheckInSchema.safeParse({ ...valid, accuracy: 100 })
        .success,
    ).toBe(true);
  });

  it("rejects a reading that is worse than the accuracy ceiling", () => {
    expect(
      attendanceMeetingCheckInSchema.safeParse({ ...valid, accuracy: 100.1 })
        .success,
    ).toBe(false);
  });

  it("rejects a short or malformed NIM", () => {
    expect(
      attendanceMeetingCheckInSchema.safeParse({ ...valid, nim: "21" }).success,
    ).toBe(false);

    expect(
      attendanceMeetingCheckInSchema.safeParse({
        ...valid,
        nim: "2112 0123",
      }).success,
    ).toBe(false);
  });

  it("rejects missing client identity instead of inventing one", () => {
    expect(
      attendanceMeetingCheckInSchema.safeParse({
        latitude: 0,
        longitude: 0,
        accuracy: 10,
      }).success,
    ).toBe(false);
  });
});

describe("attendanceMeetingCloseSchema", () => {
  it("finalizes by default", () => {
    expect(attendanceMeetingCloseSchema.parse({}).finalize).toBe(true);
  });

  it("allows closing without finalizing", () => {
    expect(
      attendanceMeetingCloseSchema.parse({ finalize: false }).finalize,
    ).toBe(false);
  });
});

describe("attendanceMeetingLocationChangeSchema", () => {
  it("requires a reason for the audited change", () => {
    expect(
      attendanceMeetingLocationChangeSchema.safeParse({
        latitude: -6.36,
        longitude: 106.82,
        radiusM: 100,
      }).success,
    ).toBe(false);
  });
});

describe("resolveAttendanceMeetingPhase", () => {
  const base = {
    attendance_opened_at: null,
    attendance_closed_at: null,
    attendance_finalized_at: null,
    attendance_closes_at: "2026-11-02T10:00:00+07:00",
    ends_at: "2026-11-02T10:00:00+07:00",
  };
  const now = Date.parse("2026-11-02T09:00:00+07:00");

  it("reports a meeting that has never been opened as scheduled", () => {
    expect(resolveAttendanceMeetingPhase(base, now)).toBe("scheduled");
  });

  it("reports an opened meeting as open before the window closes", () => {
    expect(
      resolveAttendanceMeetingPhase(
        { ...base, attendance_opened_at: "2026-11-02T08:00:00+07:00" },
        now,
      ),
    ).toBe("open");
  });

  it("derives closed from the closing time even before a manual close", () => {
    expect(
      resolveAttendanceMeetingPhase(
        { ...base, attendance_opened_at: "2026-11-02T08:00:00+07:00" },
        Date.parse("2026-11-02T10:05:00+07:00"),
      ),
    ).toBe("closed");
  });

  it("lets an explicit close and finalization win", () => {
    expect(
      resolveAttendanceMeetingPhase(
        {
          ...base,
          attendance_opened_at: "2026-11-02T08:00:00+07:00",
          attendance_closed_at: "2026-11-02T09:00:00+07:00",
        },
        now,
      ),
    ).toBe("closed");

    expect(
      resolveAttendanceMeetingPhase(
        {
          ...base,
          attendance_opened_at: "2026-11-02T08:00:00+07:00",
          attendance_closed_at: "2026-11-02T09:00:00+07:00",
          attendance_finalized_at: "2026-11-02T09:00:00+07:00",
        },
        now,
      ),
    ).toBe("finalized");
  });
});

describe("getAttendanceLateDeadline", () => {
  it("adds the late minutes to the start instant", () => {
    expect(getAttendanceLateDeadline("2026-11-02T08:00:00+07:00", 10)).toBe(
      Date.parse("2026-11-02T08:10:00+07:00"),
    );
  });

  it("treats zero as no grace period", () => {
    expect(getAttendanceLateDeadline("2026-11-02T08:00:00+07:00", 0)).toBe(
      Date.parse("2026-11-02T08:00:00+07:00"),
    );
  });

  it("returns null for an invalid start", () => {
    expect(getAttendanceLateDeadline("not-a-date", 10)).toBeNull();
  });
});

describe("attendanceMeetingCorrectionSchema", () => {
  const valid = {
    userId: "11111111-1111-4111-8111-111111111111",
    status: "present",
    reason: "Student in room; GPS accuracy too poor",
    physicallyVerified: true,
  } as const;

  it("accepts a physically verified correction to present", () => {
    expect(attendanceMeetingCorrectionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a present correction without a reason", () => {
    expect(
      attendanceMeetingCorrectionSchema.safeParse({ ...valid, reason: "" })
        .success,
    ).toBe(false);
  });

  it("rejects a present correction without physical verification", () => {
    const parsed = attendanceMeetingCorrectionSchema.safeParse({
      ...valid,
      physicallyVerified: false,
    });

    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) => issue.path[0] === "physicallyVerified"),
      ).toBe(true);
    }
  });

  it("allows a non-present correction without physical verification", () => {
    expect(
      attendanceMeetingCorrectionSchema.safeParse({
        ...valid,
        status: "excused",
        physicallyVerified: false,
      }).success,
    ).toBe(true);
  });
});
