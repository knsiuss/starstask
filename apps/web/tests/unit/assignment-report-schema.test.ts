import { describe, expect, it } from "vitest";

import {
  assignmentReportCreateSchema,
  assignmentReportReviewSchema,
} from "@starstask/contracts";

describe("assignmentReportCreateSchema", () => {
  it("accepts a known reason without a note", () => {
    const parsed = assignmentReportCreateSchema.safeParse({
      reason: "wrong_deadline",
    });

    expect(parsed.success).toBe(true);
  });

  it("treats an empty note as absent", () => {
    const parsed = assignmentReportCreateSchema.safeParse({
      reason: "other",
      note: "   ",
    });

    expect(parsed.success && parsed.data.note).toBeUndefined();
  });

  it("accepts a note with five or more characters", () => {
    const parsed = assignmentReportCreateSchema.safeParse({
      reason: "wrong_details",
      note: "Room changed",
    });

    expect(parsed.success && parsed.data.note).toBe("Room changed");
  });

  it("rejects a note that is too short", () => {
    const parsed = assignmentReportCreateSchema.safeParse({
      reason: "other",
      note: "abc",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown reason", () => {
    const parsed = assignmentReportCreateSchema.safeParse({
      reason: "i_do_not_like_it",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("assignmentReportReviewSchema", () => {
  it("accepts resolved and dismissed", () => {
    expect(
      assignmentReportReviewSchema.safeParse({ status: "resolved" }).success,
    ).toBe(true);
    expect(
      assignmentReportReviewSchema.safeParse({ status: "dismissed" }).success,
    ).toBe(true);
  });

  it("rejects reopening through the review endpoint", () => {
    expect(
      assignmentReportReviewSchema.safeParse({ status: "open" }).success,
    ).toBe(false);
  });
});
