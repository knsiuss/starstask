import { describe, expect, it } from "vitest";

import {
  buildAttendanceAtRiskDedupeKey,
  buildAttendanceAtRiskPayload,
  buildLecturerAlerts,
  buildTeachingBehindPaceDedupeKey,
  buildTeachingBehindPacePayload,
  clampTargetMeetings,
  isoWeekKeyForDate,
  isAtRiskPercentage,
  isLecturerAlertUrlAllowed,
  resolveBehindPaceTarget,
  truncate,
  TARGET_MEETINGS_DEFAULT,
  TARGET_MEETINGS_MAX,
  TARGET_MEETINGS_MIN,
} from "@/lib/push/lecturer-proactive";

const ISO_WEEK = "2026-W47";
const NOW = new Date("2026-11-18T00:00:00.000Z");

describe("isoWeekKeyForDate", () => {
  it("formats a UTC date as the ISO week it belongs to (Asia/Jakarta weekdays align)", () => {
    expect(isoWeekKeyForDate(NOW)).toBe("2026-W47");
    expect(isoWeekKeyForDate(new Date("2026-01-05T00:00:00.000Z"))).toBe(
      "2026-W02",
    );
  });
});

describe("truncate", () => {
  it("keeps short values unchanged", () => {
    expect(truncate("abc", 5)).toBe("abc");
  });

  it("truncates beyond the maximum length", () => {
    const long = "x".repeat(500);

    expect(truncate(long, 120).length).toBe(120);
    expect(truncate(long, 240).length).toBe(240);
  });
});

describe("clampTargetMeetings", () => {
  it("defaults to 14 when nothing is configured", () => {
    expect(clampTargetMeetings(undefined)).toBe(TARGET_MEETINGS_DEFAULT);
    expect(clampTargetMeetings(Number.NaN)).toBe(TARGET_MEETINGS_DEFAULT);
  });

  it("clamps to the 14..16 window", () => {
    expect(clampTargetMeetings(10)).toBe(TARGET_MEETINGS_MIN);
    expect(clampTargetMeetings(99)).toBe(TARGET_MEETINGS_MAX);
    expect(clampTargetMeetings(15)).toBe(15);
  });
});

describe("resolveBehindPaceTarget", () => {
  it("returns the default when no meeting pins a target", () => {
    expect(resolveBehindPaceTarget([])).toBe(TARGET_MEETINGS_DEFAULT);
    expect(
      resolveBehindPaceTarget([
        { targetMeetings: null },
        { targetMeetings: undefined },
      ]),
    ).toBe(TARGET_MEETINGS_DEFAULT);
  });

  it("uses the maximum configured target across the meetings, clamped", () => {
    expect(
      resolveBehindPaceTarget([{ targetMeetings: 12 }, { targetMeetings: 16 }]),
    ).toBe(16);
  });
});

describe("isAtRiskPercentage", () => {
  it("treats exactly 75% as not at risk", () => {
    expect(isAtRiskPercentage(75)).toBe(false);
  });

  it("treats 74.9% as at risk", () => {
    expect(isAtRiskPercentage(74.9)).toBe(true);
  });

  it("ignores null percentages", () => {
    expect(isAtRiskPercentage(null)).toBe(false);
  });
});

describe("buildAttendanceAtRiskPayload", () => {
  it("produces a valid payload with an internal url and bounded lengths", () => {
    const payload = buildAttendanceAtRiskPayload({
      classId: "class-1",
      subjectId: "subject-1",
      subjectName: "Basis Data",
      atRiskCount: 2,
      classSlug: "class-a",
      isoWeek: ISO_WEEK,
    });

    expect(payload).not.toBeNull();
    expect(payload?.title).toBe("Attendance at risk");
    expect(payload?.title.length).toBeLessThanOrEqual(120);
    expect(payload?.body).toContain("2 students");
    expect(payload?.body).toContain("Basis Data");
    expect(payload?.body).toContain("75");
    expect(payload?.body.length).toBeLessThanOrEqual(240);
    expect(payload?.url).toBe("/classes/class-a/attendance");
    expect(isLecturerAlertUrlAllowed(payload!.url)).toBe(true);
  });

  it("uses the singular form for a single student", () => {
    const payload = buildAttendanceAtRiskPayload({
      classId: "class-1",
      subjectId: "subject-1",
      subjectName: "Basis Data",
      atRiskCount: 1,
      classSlug: "class-a",
      isoWeek: ISO_WEEK,
    });

    expect(payload?.body).toContain("1 student");
    expect(payload?.body).not.toContain("students");
  });

  it("refuses an external URL even if the slug tries to become one", () => {
    const payload = buildAttendanceAtRiskPayload({
      classId: "class-1",
      subjectId: "subject-1",
      subjectName: "Basis Data",
      atRiskCount: 2,
      // Any slug that fails the class-path allowlist must produce null.
      classSlug: "https://example.com",
      isoWeek: ISO_WEEK,
    });

    expect(payload).toBeNull();
  });
});

describe("buildTeachingBehindPacePayload", () => {
  it("produces a valid payload with clamped target", () => {
    const payload = buildTeachingBehindPacePayload({
      offeringId: "off-1",
      courseName: "Algoritma",
      meetingsHeld: 10,
      targetMeetings: 10,
      classSlug: "class-a",
      isoWeek: ISO_WEEK,
    });

    expect(payload).not.toBeNull();
    expect(payload?.title).toBe("Below target pace");
    expect(payload?.body).toContain("Algoritma");
    expect(payload?.body).toContain("10/14 meetings");
    expect(payload?.body.length).toBeLessThanOrEqual(240);
    expect(payload?.url).toBe("/classes/class-a/attendance");
    expect(isLecturerAlertUrlAllowed(payload!.url)).toBe(true);
  });

  it("refuses a class slug that fails the allowlist", () => {
    const payload = buildTeachingBehindPacePayload({
      offeringId: "off-1",
      courseName: "Algoritma",
      meetingsHeld: 4,
      targetMeetings: 14,
      classSlug: "//evil.example",
      isoWeek: ISO_WEEK,
    });

    expect(payload).toBeNull();
  });
});

describe("dedupe keys", () => {
  it("formats attendance_at_risk keys as classId:subjectId:adminUserId:isoWeek", () => {
    expect(
      buildAttendanceAtRiskDedupeKey("cls", "sub", "admin-1", ISO_WEEK),
    ).toBe(`attendance_at_risk:cls:sub:admin-1:${ISO_WEEK}`);
  });

  it("formats teaching_behind_pace keys as offeringId:adminUserId:isoWeek", () => {
    expect(buildTeachingBehindPaceDedupeKey("off", "admin-1", ISO_WEEK)).toBe(
      `teaching_behind_pace:off:admin-1:${ISO_WEEK}`,
    );
  });
});

describe("isLecturerAlertUrlAllowed", () => {
  it("allows internal class attendance paths", () => {
    expect(isLecturerAlertUrlAllowed("/classes/x/attendance")).toBe(true);
  });

  it("rejects external or protocol-relative URLs", () => {
    expect(isLecturerAlertUrlAllowed("https://example.com")).toBe(false);
    expect(isLecturerAlertUrlAllowed("//example.com")).toBe(false);
    expect(isLecturerAlertUrlAllowed("/\\evil")).toBe(false);
  });
});

describe("buildLecturerAlerts", () => {
  it("enqueues below-target pace for offerings behind only", () => {
    const planned = buildLecturerAlerts({
      isoWeek: ISO_WEEK,
      atRiskSubjects: [],
      paceOfferings: [
        {
          offeringId: "off-1",
          classId: "cls-1",
          classSlug: "class-a",
          courseName: "Basis Data",
          meetingsHeld: 13,
          targetMeetings: 14,
        },
        {
          offeringId: "off-2",
          classId: "cls-1",
          classSlug: "class-a",
          courseName: "Algoritma",
          meetingsHeld: 14,
          targetMeetings: 14,
        },
      ],
      classAdmins: [{ classId: "cls-1", userId: "user-1" }],
    });

    expect(planned).toHaveLength(1);
    expect(planned[0]?.kind).toBe("teaching_behind_pace");
    expect(planned[0]?.userId).toBe("user-1");
    expect(planned[0]?.dedupeKey).toBe(
      `teaching_behind_pace:off-1:user-1:${ISO_WEEK}`,
    );
    expect(planned[0]?.payload.body).toContain("13/14");
  });

  it("enqueues at-risk for subjects behind only", () => {
    const planned = buildLecturerAlerts({
      isoWeek: ISO_WEEK,
      atRiskSubjects: [
        {
          classId: "cls-1",
          classSlug: "class-a",
          subjectId: "sub-1",
          subjectName: "Basis Data",
          atRiskCount: 0,
        },
        {
          classId: "cls-1",
          classSlug: "class-a",
          subjectId: "sub-2",
          subjectName: "Algoritma",
          atRiskCount: 2,
        },
      ],
      paceOfferings: [],
      classAdmins: [{ classId: "cls-1", userId: "user-1" }],
    });

    expect(planned).toHaveLength(1);
    expect(planned[0]?.kind).toBe("attendance_at_risk");
    expect(planned[0]?.dedupeKey).toBe(
      `attendance_at_risk:cls-1:sub-2:user-1:${ISO_WEEK}`,
    );
  });

  it("fans out to every admin of the class and dedupes repeated user ids", () => {
    const planned = buildLecturerAlerts({
      isoWeek: ISO_WEEK,
      atRiskSubjects: [
        {
          classId: "cls-1",
          classSlug: "class-a",
          subjectId: "sub-1",
          subjectName: "Basis Data",
          atRiskCount: 2,
        },
      ],
      paceOfferings: [],
      classAdmins: [
        { classId: "cls-1", userId: "user-1" },
        { classId: "cls-1", userId: "user-2" },
        { classId: "cls-1", userId: "user-1" },
      ],
    });

    expect(planned).toHaveLength(2);
    expect(new Set(planned.map((row) => row.userId)).size).toBe(2);
    expect(new Set(planned.map((row) => row.dedupeKey)).size).toBe(2);
    expect(
      planned.every(
        (row) =>
          row.dedupeKey ===
          `attendance_at_risk:cls-1:sub-1:${row.userId}:${ISO_WEEK}`,
      ),
    ).toBe(true);
  });

  it("enqueues nothing when the offering is at or above target", () => {
    const planned = buildLecturerAlerts({
      isoWeek: ISO_WEEK,
      atRiskSubjects: [],
      paceOfferings: [
        {
          offeringId: "off-1",
          classId: "cls-1",
          classSlug: "class-a",
          courseName: "Basis Data",
          meetingsHeld: 16,
          targetMeetings: 16,
        },
      ],
      classAdmins: [{ classId: "cls-1", userId: "user-1" }],
    });

    expect(planned).toEqual([]);
  });

  it("never emits when there is no admin for the class", () => {
    const planned = buildLecturerAlerts({
      isoWeek: ISO_WEEK,
      atRiskSubjects: [
        {
          classId: "cls-1",
          classSlug: "class-a",
          subjectId: "sub-1",
          subjectName: "Basis Data",
          atRiskCount: 3,
        },
      ],
      paceOfferings: [],
      classAdmins: [],
    });

    expect(planned).toEqual([]);
  });
});

describe("readProactiveSummary", () => {
  it("accepts the RPC's jsonb payload shape", async () => {
    const { readProactiveSummary } =
      await import("@/lib/push/lecturer-proactive");

    expect(
      readProactiveSummary({
        at_risk_subjects: 3,
        behind_pace_offerings: 1,
      }),
    ).toEqual({ atRiskSubjects: 3, behindPaceOfferings: 1 });
  });

  it("rejects non-object shapes so the cron never reports a false success", async () => {
    const { readProactiveSummary } =
      await import("@/lib/push/lecturer-proactive");

    expect(readProactiveSummary(null)).toBeNull();
    expect(readProactiveSummary("ok")).toBeNull();
    expect(readProactiveSummary([])).toBeNull();
    expect(readProactiveSummary({})).toBeNull();
    expect(readProactiveSummary({ at_risk_subjects: "nope" })).toBeNull();
  });
});
