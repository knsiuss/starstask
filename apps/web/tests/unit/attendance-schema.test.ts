import { describe, expect, it } from "vitest";

import {
  attendanceQuerySchema,
  leaveRequestReviewSchema,
} from "@starstask/contracts";

describe("attendanceQuerySchema", () => {
  it("defaults to all statuses and no filters", () => {
    const parsed = attendanceQuerySchema.parse({});

    expect(parsed.status).toBe("all");
    expect(parsed.class).toBeUndefined();
    expect(parsed.from).toBeUndefined();
  });

  it("accepts a complete filtered query", () => {
    const parsed = attendanceQuerySchema.parse({
      class: "11111111-1111-4111-8111-111111111111",
      subject: "22222222-2222-4222-8222-222222222222",
      year: "2026/2027",
      semester: "Odd",
      status: "late",
      from: "2026-09-01",
      to: "2026-12-31",
    });

    expect(parsed.status).toBe("late");
    expect(parsed.year).toBe("2026/2027");
  });

  it("rejects an impossible date and a reversed range", () => {
    expect(
      attendanceQuerySchema.safeParse({ from: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      attendanceQuerySchema.safeParse({
        from: "2026-12-31",
        to: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(attendanceQuerySchema.safeParse({ status: "skipped" }).success).toBe(
      false,
    );
  });
});

describe("leaveRequestReviewSchema", () => {
  it("accepts approve and reject decisions", () => {
    expect(
      leaveRequestReviewSchema.parse({ decision: "approved" }).decision,
    ).toBe("approved");
    expect(
      leaveRequestReviewSchema.parse({
        decision: "rejected",
        note: "The document is not legible.",
      }).note,
    ).toBe("The document is not legible.");
  });

  it("normalises an empty note to null and rejects an unknown decision", () => {
    expect(
      leaveRequestReviewSchema.parse({ decision: "approved", note: "" }).note,
    ).toBeNull();
    expect(
      leaveRequestReviewSchema.safeParse({ decision: "pending" }).success,
    ).toBe(false);
  });

  it("rejects an overlong note", () => {
    expect(
      leaveRequestReviewSchema.safeParse({
        decision: "approved",
        note: "x".repeat(2_001),
      }).success,
    ).toBe(false);
  });

  it("accepts a revision decision with an explanatory note", () => {
    expect(
      leaveRequestReviewSchema.parse({
        decision: "revision_requested",
        note: "Fix the absence dates.",
      }).decision,
    ).toBe("revision_requested");
  });

  it("requires a note for reject and revision decisions", () => {
    expect(
      leaveRequestReviewSchema.safeParse({ decision: "rejected" }).success,
    ).toBe(false);
    expect(
      leaveRequestReviewSchema.safeParse({ decision: "revision_requested" })
        .success,
    ).toBe(false);
    expect(
      leaveRequestReviewSchema.safeParse({
        decision: "rejected",
        note: "ab",
      }).success,
    ).toBe(false);
  });
});
