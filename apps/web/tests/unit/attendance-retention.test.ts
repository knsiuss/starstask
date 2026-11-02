import { describe, expect, it } from "vitest";

import {
  DEFAULT_ATTENDANCE_RETENTION_DAYS,
  MAX_ATTENDANCE_RETENTION_DAYS,
  resolveAttendanceRetentionDays,
} from "@/lib/attendance/retention";

describe("resolveAttendanceRetentionDays", () => {
  it("defaults to 30 days when unset", () => {
    expect(resolveAttendanceRetentionDays({})).toBe(
      DEFAULT_ATTENDANCE_RETENTION_DAYS,
    );
  });

  it("accepts a positive whole number", () => {
    expect(
      resolveAttendanceRetentionDays({ ATTENDANCE_RETENTION_DAYS: " 45 " }),
    ).toBe(45);
  });

  it("falls back for zero, fractions, and text", () => {
    for (const value of ["0", "-1", "1.5", "30days", "NaN"]) {
      expect(
        resolveAttendanceRetentionDays({ ATTENDANCE_RETENTION_DAYS: value }),
      ).toBe(DEFAULT_ATTENDANCE_RETENTION_DAYS);
    }
  });

  it("falls back above the documented maximum", () => {
    expect(
      resolveAttendanceRetentionDays({
        ATTENDANCE_RETENTION_DAYS: String(MAX_ATTENDANCE_RETENTION_DAYS + 1),
      }),
    ).toBe(DEFAULT_ATTENDANCE_RETENTION_DAYS);
  });

  it("accepts the maximum", () => {
    expect(
      resolveAttendanceRetentionDays({
        ATTENDANCE_RETENTION_DAYS: String(MAX_ATTENDANCE_RETENTION_DAYS),
      }),
    ).toBe(MAX_ATTENDANCE_RETENTION_DAYS);
  });
});
