import { describe, expect, it } from "vitest";

import {
  buildWorkspaceHref,
  deadlineUrgency,
  formatRemainingTime,
  requestFeedback,
  sortScheduleItems,
  toRequestStatus,
} from "@/lib/assignments/workspace";

describe("toRequestStatus", () => {
  it("maps published rows to approved", () => {
    expect(
      toRequestStatus({ status: "published", rejection_reason: null }),
    ).toBe("approved");
  });

  it("maps pending_review rows to pending", () => {
    expect(
      toRequestStatus({ status: "pending_review", rejection_reason: null }),
    ).toBe("pending");
  });

  it("maps rejected rows to rejected without a revision marker", () => {
    expect(
      toRequestStatus({
        status: "rejected",
        rejection_reason: "Please attach the source file.",
      }),
    ).toBe("rejected");
  });

  it("maps rejected rows with the revision marker to revision_requested", () => {
    expect(
      toRequestStatus({
        status: "rejected",
        rejection_reason: "Revision requested: include the rubric.",
      }),
    ).toBe("revision_requested");
  });

  it("strips the revision marker from the student-facing feedback", () => {
    expect(
      requestFeedback({
        status: "rejected",
        rejection_reason: "Revision requested: include the rubric.",
      }),
    ).toBe("include the rubric.");
  });

  it("returns plain feedback for a normal rejection", () => {
    expect(
      requestFeedback({
        status: "rejected",
        rejection_reason: "Duplicate of an existing task.",
      }),
    ).toBe("Duplicate of an existing task.");
  });

  it("returns null feedback for non-rejected rows", () => {
    expect(
      requestFeedback({ status: "published", rejection_reason: null }),
    ).toBeNull();
  });
});

describe("sortScheduleItems", () => {
  const items = [
    { id: "b", created_at: "2026-01-02T00:00:00Z", deadline: null },
    {
      id: "a",
      created_at: "2026-01-01T00:00:00Z",
      deadline: "2026-02-01T00:00:00Z",
    },
    {
      id: "c",
      created_at: "2026-01-03T00:00:00Z",
      deadline: "2026-01-15T00:00:00Z",
    },
  ];

  it("sorts newest first by creation date", () => {
    expect(sortScheduleItems(items, "newest").map((i) => i.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts oldest first by creation date", () => {
    expect(sortScheduleItems(items, "oldest").map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("sorts by nearest deadline with deadline-less rows last", () => {
    expect(sortScheduleItems(items, "deadline").map((i) => i.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("does not mutate the input array", () => {
    sortScheduleItems(items, "deadline");
    expect(items.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});

describe("deadlineUrgency / formatRemainingTime", () => {
  const now = new Date("2026-11-04T00:00:00Z");

  it("classifies future, past, and missing deadlines", () => {
    expect(deadlineUrgency("2026-11-10T00:00:00Z", now)).toBe("upcoming");
    expect(deadlineUrgency("2026-11-01T00:00:00Z", now)).toBe("expired");
    expect(deadlineUrgency(null, now)).toBe("none");
  });

  it("formats upcoming and expired durations", () => {
    expect(formatRemainingTime("2026-11-07T00:00:00Z", now)).toBe("in 3 days");
    expect(formatRemainingTime("2026-11-04T05:00:00Z", now)).toBe("in 5 hours");
    expect(formatRemainingTime("2026-11-02T00:00:00Z", now)).toBe(
      "expired 2 days ago",
    );
    expect(formatRemainingTime(null, now)).toBeNull();
  });
});

describe("buildWorkspaceHref", () => {
  it("keeps defaults out of the URL", () => {
    expect(buildWorkspaceHref({})).toBe("/assignments");
    expect(
      buildWorkspaceHref({ tab: "schedule", status: "all", sort: "newest" }),
    ).toBe("/assignments");
  });

  it("includes active filters and tab", () => {
    const href = buildWorkspaceHref({
      tab: "requests",
      search: "quiz",
      status: "upcoming",
      sort: "deadline",
    });

    expect(href).toContain("tab=requests");
    expect(href).toContain("search=quiz");
    expect(href).toContain("status=upcoming");
    expect(href).toContain("sort=deadline");
  });
});
