import { describe, expect, it } from "vitest";

import {
  academicYearCreateSchema,
  announcementCreateSchema,
  attendanceCorrectionSchema,
  attendanceRosterUpsertSchema,
  classAdminGrantSchema,
} from "@starstask/contracts";

describe("academicYearCreateSchema", () => {
  const valid = {
    code: "2026/2027",
    name: "Academic Year 2026/2027",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
  };

  it("accepts a valid year and defaults status/current flag", () => {
    const parsed = academicYearCreateSchema.parse(valid);

    expect(parsed.status).toBe("planned");
    expect(parsed.isCurrent).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    expect(
      academicYearCreateSchema.safeParse({
        ...valid,
        endDate: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("rejects an oversized code", () => {
    expect(
      academicYearCreateSchema.safeParse({ ...valid, code: "x".repeat(41) })
        .success,
    ).toBe(false);
  });
});

describe("classAdminGrantSchema", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const identityId = "22222222-2222-4222-8222-222222222222";

  it("requires exactly one target", () => {
    expect(
      classAdminGrantSchema.safeParse({ permissionCodes: ["manage_grades"] })
        .success,
    ).toBe(false);
    expect(
      classAdminGrantSchema.safeParse({
        userId,
        studentIdentityId: identityId,
        permissionCodes: ["manage_grades"],
      }).success,
    ).toBe(false);
  });

  it("accepts a single target with valid permission codes", () => {
    const parsed = classAdminGrantSchema.parse({
      userId,
      permissionCodes: ["manage_admins", "manage_attendance"],
    });

    expect(parsed.permissionCodes).toContain("manage_admins");
  });

  it("rejects an unknown permission code", () => {
    expect(
      classAdminGrantSchema.safeParse({
        userId,
        permissionCodes: ["manage_everything"],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty permission selection", () => {
    expect(
      classAdminGrantSchema.safeParse({ userId, permissionCodes: [] }).success,
    ).toBe(false);
  });
});

describe("attendanceRosterUpsertSchema", () => {
  const identityId = "33333333-3333-4333-8333-333333333333";

  it("accepts the verified status set only", () => {
    for (const status of ["present", "late", "excused", "sick", "absent"]) {
      expect(
        attendanceRosterUpsertSchema.safeParse({
          meetingId: identityId,
          entries: [{ studentIdentityId: identityId, status }],
        }).success,
      ).toBe(true);
    }

    expect(
      attendanceRosterUpsertSchema.safeParse({
        meetingId: identityId,
        entries: [{ studentIdentityId: identityId, status: "not_applicable" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty entry list", () => {
    expect(
      attendanceRosterUpsertSchema.safeParse({
        meetingId: identityId,
        entries: [],
      }).success,
    ).toBe(false);
  });
});

describe("attendanceCorrectionSchema", () => {
  const recordId = "44444444-4444-4444-8444-444444444444";

  it("requires a reason of at least 3 characters", () => {
    expect(
      attendanceCorrectionSchema.safeParse({
        recordId,
        newStatus: "sick",
        reason: "ok",
      }).success,
    ).toBe(false);

    expect(
      attendanceCorrectionSchema.safeParse({
        recordId,
        newStatus: "sick",
        reason: "Medical certificate verified by admin",
      }).success,
    ).toBe(true);
  });
});

describe("announcementCreateSchema", () => {
  it("trims and bounds the title", () => {
    expect(
      announcementCreateSchema.safeParse({
        title: "ab",
        body: "Hello class",
      }).success,
    ).toBe(false);

    expect(
      announcementCreateSchema.safeParse({
        title: " a ".repeat(120),
        body: "Hello class",
      }).success,
    ).toBe(false);
  });

  it("defaults pinned to false and publish to true", () => {
    const parsed = announcementCreateSchema.parse({
      title: "Exam moved",
      body: "Moved to Friday 09:00",
    });

    expect(parsed.pinned).toBe(false);
    expect(parsed.publish).toBe(true);
  });
});
