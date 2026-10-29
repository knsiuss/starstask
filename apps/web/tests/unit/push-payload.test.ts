import { describe, expect, it } from "vitest";

import {
  buildReminderPayload,
  isSafeNotificationPath,
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
} from "@/lib/push/payload";

const ASSIGNMENT_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";
const NOW_MS = Date.parse("2026-10-29T03:00:00.000Z");
const DEADLINE = "2026-10-30T03:00:00.000Z";

function payload(
  overrides: Partial<Parameters<typeof buildReminderPayload>[0]> = {},
) {
  return buildReminderPayload({
    assignmentId: ASSIGNMENT_ID,
    courseName: "Algorithms",
    deadline: DEADLINE,
    reminderType: "24h",
    timezone: "Asia/Jakarta",
    nowMs: NOW_MS,
    ...overrides,
  });
}

describe("buildReminderPayload", () => {
  it("builds a compact payload with an internal assignment URL", () => {
    const result = payload();

    expect(result).not.toBeNull();
    expect(result?.title).toBe("StarsTask: Deadline tomorrow");
    expect(result?.url).toBe(`/assignments/${ASSIGNMENT_ID}`);
    expect(result?.icon).toBe(NOTIFICATION_ICON);
    expect(result?.badge).toBe(NOTIFICATION_BADGE);
    expect(result?.timestamp).toBe(NOW_MS);
  });

  it("renders the deadline in the user's time zone", () => {
    const result = payload();

    expect(result?.body).toContain("Algorithms");
    expect(result?.body).toContain("24 hours");
    expect(result?.body).toContain("30 Oct 2026, 10:00 WIB");
  });

  it("uses a different title for the three-hour reminder", () => {
    const result = payload({
      reminderType: "3h",
      deadline: "2026-10-29T06:00:00.000Z",
    });

    expect(result?.title).toBe("StarsTask: Deadline in a few hours");
    expect(result?.body).toContain("3 hours");
  });

  it("rounds a fractional hour count to the nearest hour", () => {
    const result = payload({ deadline: "2026-10-29T04:30:00.000Z" });

    expect(result?.body).toContain("2 hours");
  });

  it("falls back to a generic course name", () => {
    const result = payload({ courseName: "   " });

    expect(result?.body).toContain("Your course assignment");
  });

  it("truncates a very long course name", () => {
    const result = payload({ courseName: "A".repeat(80) });

    expect(result?.body).not.toContain("A".repeat(80));
    expect(result?.body).toContain("…");
  });

  it("includes the reminder type and deadline in the tag so redelivery replaces it", () => {
    const result = payload();

    expect(result?.tag).toBe(`starstask:${ASSIGNMENT_ID}:24h:${DEADLINE}`);
  });

  it("returns null when the assignment id is not a UUID", () => {
    expect(payload({ assignmentId: "not-a-uuid" })).toBeNull();
  });

  it("returns null when the deadline cannot be parsed", () => {
    expect(payload({ deadline: "tomorrow-ish" })).toBeNull();
  });

  it("never includes an owner id or email in the payload", () => {
    const result = payload();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("user_id");
    expect(serialized).not.toContain("@");
  });
});

describe("isSafeNotificationPath", () => {
  it("accepts a published assignment path", () => {
    expect(isSafeNotificationPath(`/assignments/${ASSIGNMENT_ID}`)).toBe(true);
  });

  it.each([
    {
      label: "an external URL",
      value: `https://evil.example/assignments/${ASSIGNMENT_ID}`,
    },
    {
      label: "a protocol-relative URL",
      value: `//evil.example/assignments/${ASSIGNMENT_ID}`,
    },
    { label: "a path without a UUID", value: "/assignments/123" },
    { label: "a nested path", value: `/assignments/${ASSIGNMENT_ID}/edit` },
    { label: "the home page", value: "/" },
  ])("rejects $label", ({ value }) => {
    expect(isSafeNotificationPath(value)).toBe(false);
  });
});
