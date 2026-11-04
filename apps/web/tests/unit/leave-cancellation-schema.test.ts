import { describe, expect, it } from "vitest";

import {
  LEAVE_CANCELLATION_NOTE_MAX,
  LEAVE_REQUEST_STATUSES,
  LEAVE_REVIEW_NOTE_MAX,
  LEAVE_STATUS_LABELS,
  isLeaveRequestCancellable,
  isLeaveRequestEditable,
  isLeaveRequestForwardable,
  leaveCancellationSchema,
  leaveRequestReviewSchema,
} from "@starstask/contracts";

/**
 * Cancellation, review, and status rules.
 *
 * A class admin now records an explicit approval, rejection, or revision
 * request. Cancellation is administrative rather than a decision. These tests
 * pin both payload shapes and the transition helpers the UI relies on.
 */

describe("leaveCancellationSchema", () => {
  it("accepts an empty body, because the note is optional", () => {
    expect(leaveCancellationSchema.safeParse({}).success).toBe(true);
    expect(leaveCancellationSchema.safeParse({ note: null }).success).toBe(
      true,
    );
  });

  it("normalises a blank note to null", () => {
    const parsed = leaveCancellationSchema.safeParse({ note: "   " });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.note).toBeNull();
    }
  });

  it("trims the note", () => {
    const parsed = leaveCancellationSchema.safeParse({
      note: "  Student withdrew  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.note).toBe("Student withdrew");
    }
  });

  it("accepts exactly the maximum length", () => {
    expect(
      leaveCancellationSchema.safeParse({
        note: "a".repeat(LEAVE_CANCELLATION_NOTE_MAX),
      }).success,
    ).toBe(true);
  });

  it("rejects a note longer than the limit", () => {
    expect(
      leaveCancellationSchema.safeParse({
        note: "a".repeat(LEAVE_CANCELLATION_NOTE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("drops any status a client tries to inject", () => {
    const parsed = leaveCancellationSchema.safeParse({
      note: "done",
      status: "forwarded",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("status");
    }
  });
});

describe("leaveRequestReviewSchema", () => {
  it("accepts every decision", () => {
    expect(
      leaveRequestReviewSchema.safeParse({ decision: "approved" }).success,
    ).toBe(true);

    for (const decision of ["rejected", "revision_requested"] as const) {
      expect(
        leaveRequestReviewSchema.safeParse({
          decision,
          note: "Please revise and resubmit.",
        }).success,
      ).toBe(true);
      // A rejection or revision must explain what to fix.
      expect(leaveRequestReviewSchema.safeParse({ decision }).success).toBe(
        false,
      );
    }
  });

  it("rejects any other decision", () => {
    expect(
      leaveRequestReviewSchema.safeParse({ decision: "forwarded" }).success,
    ).toBe(false);
    expect(leaveRequestReviewSchema.safeParse({}).success).toBe(false);
  });

  it("normalises a blank note to null and trims a real one", () => {
    const blank = leaveRequestReviewSchema.safeParse({
      decision: "approved",
      note: "   ",
    });
    const filled = leaveRequestReviewSchema.safeParse({
      decision: "rejected",
      note: "  Missing document  ",
    });

    expect(blank.success && blank.data.note).toBeNull();
    expect(filled.success && filled.data.note).toBe("Missing document");
  });

  it("limits the note length", () => {
    expect(
      leaveRequestReviewSchema.safeParse({
        decision: "approved",
        note: "a".repeat(LEAVE_REVIEW_NOTE_MAX),
      }).success,
    ).toBe(true);
    expect(
      leaveRequestReviewSchema.safeParse({
        decision: "approved",
        note: "a".repeat(LEAVE_REVIEW_NOTE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("drops any status a client tries to inject", () => {
    const parsed = leaveRequestReviewSchema.safeParse({
      decision: "approved",
      status: "forwarded",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("status");
    }
  });
});

describe("absence status model", () => {
  it("has explicit approval, rejection, and revision statuses", () => {
    expect([...LEAVE_REQUEST_STATUSES]).toEqual([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "revision_requested",
      "forwarded",
      "cancelled",
    ]);
    expect(LEAVE_STATUS_LABELS.approved).toBe("Approved");
    expect(LEAVE_STATUS_LABELS.rejected).toBe("Rejected");
    expect(LEAVE_STATUS_LABELS.revision_requested).toBe("Revision Requested");
    expect(LEAVE_STATUS_LABELS.submitted).toBe("Pending");
  });

  it("edits a draft or a request returned for revision", () => {
    expect(isLeaveRequestEditable("draft")).toBe(true);
    expect(isLeaveRequestEditable("revision_requested")).toBe(true);

    for (const status of [
      "submitted",
      "approved",
      "rejected",
      "forwarded",
      "cancelled",
    ] as const) {
      expect(isLeaveRequestEditable(status)).toBe(false);
    }
  });

  it("only forwards a submitted request", () => {
    expect(isLeaveRequestForwardable("submitted")).toBe(true);

    for (const status of [
      "draft",
      "approved",
      "rejected",
      "revision_requested",
      "forwarded",
      "cancelled",
    ] as const) {
      expect(isLeaveRequestForwardable(status)).toBe(false);
    }
  });

  it("stops cancelling once a request is decided or forwarded", () => {
    expect(isLeaveRequestCancellable("draft")).toBe(true);
    expect(isLeaveRequestCancellable("submitted")).toBe(true);
    expect(isLeaveRequestCancellable("revision_requested")).toBe(true);

    for (const status of [
      "approved",
      "rejected",
      "forwarded",
      "cancelled",
    ] as const) {
      expect(isLeaveRequestCancellable(status)).toBe(false);
    }
  });
});
