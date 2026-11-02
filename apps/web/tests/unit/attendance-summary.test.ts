import { describe, expect, it } from "vitest";

import {
  formatAttendancePercentage,
  summarizeAttendance,
  summarizeAttendanceCounts,
  type AttendanceOutcome,
} from "@starstask/shared";

describe("summarizeAttendance", () => {
  it("counts present and late as attended and leaves excused out", () => {
    const outcomes: AttendanceOutcome[] = [
      "present",
      "present",
      "late",
      "absent",
      "excused",
    ];
    const summary = summarizeAttendance(outcomes);

    expect(summary.present).toBe(2);
    expect(summary.late).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.excused).toBe(1);
    expect(summary.attended).toBe(3);
    expect(summary.eligible).toBe(4);
    expect(summary.percentage).toBe(75);
  });

  it("does not count a missing record as present", () => {
    const summary = summarizeAttendance(["present", "unrecorded"]);

    expect(summary.attended).toBe(1);
    expect(summary.eligible).toBe(2);
    expect(summary.percentage).toBe(50);
  });

  it("excludes pending sessions from every count that matters", () => {
    const summary = summarizeAttendance(["present", "pending", "pending"]);

    expect(summary.pending).toBe(2);
    expect(summary.eligible).toBe(1);
    expect(summary.percentage).toBe(100);
  });

  it("returns a dash when nothing is eligible yet", () => {
    const summary = summarizeAttendance(["pending", "excused"]);

    expect(summary.eligible).toBe(0);
    expect(summary.percentage).toBeNull();
    expect(formatAttendancePercentage(summary.percentage)).toBe("—");
  });

  it("rounds to one decimal place", () => {
    const summary = summarizeAttendance(["present", "present", "absent"]);

    expect(summary.percentage).toBe(66.7);
    expect(formatAttendancePercentage(summary.percentage)).toBe("66.7%");
    expect(formatAttendancePercentage(100)).toBe("100%");
  });
});

describe("summarizeAttendanceCounts", () => {
  it("applies the same policy to counts computed elsewhere", () => {
    const summary = summarizeAttendanceCounts({
      present: 3,
      late: 1,
      excused: 2,
      absent: 1,
      unrecorded: 3,
      pending: 4,
    });

    expect(summary.attended).toBe(4);
    expect(summary.eligible).toBe(8);
    expect(summary.percentage).toBe(50);
    expect(summary.pending).toBe(4);
  });

  it("ignores excused and pending counts in the denominator", () => {
    const summary = summarizeAttendanceCounts({
      present: 0,
      late: 0,
      excused: 5,
      absent: 0,
      unrecorded: 0,
      pending: 2,
    });

    expect(summary.eligible).toBe(0);
    expect(summary.percentage).toBeNull();
  });
});
