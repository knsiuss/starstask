import { describe, expect, it } from "vitest";

import {
  LEAVE_CANCELLATION_NOTE_MAX,
  LEAVE_REQUEST_STATUSES,
  LEAVE_STATUS_LABELS,
  isLeaveRequestCancellable,
  isLeaveRequestEditable,
  isLeaveRequestForwardable,
  leaveCancellationSchema,
} from "@starstask/contracts";

/**
 * Cancellation and status rules.
 *
 * The workflow has no approval state: a class admin may cancel a request, but
 * only the lecturer can decide whether the absence is granted, and that happens
 * outside StarsTask. These tests pin the payload shape and the transition
 * helpers the UI relies on.
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

describe("absence status model", () => {
  it("has no approval statuses", () => {
    expect([...LEAVE_REQUEST_STATUSES]).toEqual([
      "draft",
      "submitted",
      "forwarded",
      "cancelled",
    ]);

    for (const label of Object.values(LEAVE_STATUS_LABELS)) {
      expect(label).not.toMatch(/approv|reject/i);
    }
  });

  it("only edits a draft", () => {
    expect(isLeaveRequestEditable("draft")).toBe(true);
    expect(isLeaveRequestEditable("submitted")).toBe(false);
    expect(isLeaveRequestEditable("forwarded")).toBe(false);
    expect(isLeaveRequestEditable("cancelled")).toBe(false);
  });

  it("only forwards a submitted request", () => {
    expect(isLeaveRequestForwardable("submitted")).toBe(true);
    expect(isLeaveRequestForwardable("draft")).toBe(false);
    expect(isLeaveRequestForwardable("forwarded")).toBe(false);
    expect(isLeaveRequestForwardable("cancelled")).toBe(false);
  });

  it("stops cancelling once a request is forwarded", () => {
    expect(isLeaveRequestCancellable("draft")).toBe(true);
    expect(isLeaveRequestCancellable("submitted")).toBe(true);
    expect(isLeaveRequestCancellable("forwarded")).toBe(false);
    expect(isLeaveRequestCancellable("cancelled")).toBe(false);
  });
});
