import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import {
  buildReminderPayload,
  isSafeNotificationPath,
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
} from "@/lib/push/payload";

const ASSIGNMENT_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";
const LEAVE_REQUEST_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const MESSAGE_CONV_ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW_MS = Date.parse("2026-10-29T03:00:00.000Z");
const DEADLINE = "2026-10-30T03:00:00.000Z";

function loadSwIsSafePath(): (value: unknown) => boolean {
  const swPath = resolve(process.cwd(), "public/sw.js");
  const source = readFileSync(swPath, "utf8");
  const context = {
    self: {
      addEventListener: () => {},
      location: { origin: "https://starstask.example" },
    },
    URL,
  };

  vm.runInNewContext(`${source}\nthis.__isSafePath = isSafePath;`, context);

  return (context as unknown as { __isSafePath: (value: unknown) => boolean })
    .__isSafePath;
}

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
  const swIsSafePath = loadSwIsSafePath();

  it("accepts a published assignment path", () => {
    expect(isSafeNotificationPath(`/assignments/${ASSIGNMENT_ID}`)).toBe(true);
    expect(swIsSafePath(`/assignments/${ASSIGNMENT_ID}`)).toBe(true);
  });

  it("accepts a DM conversation path", () => {
    expect(isSafeNotificationPath(`/messages/${MESSAGE_CONV_ID}`)).toBe(true);
    expect(swIsSafePath(`/messages/${MESSAGE_CONV_ID}`)).toBe(true);
  });

  it("rejects a DM path without a UUID", () => {
    expect(isSafeNotificationPath("/messages/123")).toBe(false);
    expect(swIsSafePath("/messages/123")).toBe(false);
  });

  it.each([
    "/app",
    "/app/actions",
    "/app/lecturer",
    "/app/review",
    "/lecturer",
    "/actions",
    "/assignments",
    "/my-assignments",
    "/classes",
    "/university",
    "/schedule",
    "/sessions",
    "/attendance",
    "/leave-requests",
    `/leave-requests/${LEAVE_REQUEST_ID}`,
    `/sessions/${ASSIGNMENT_ID}`,
    `/admin/assignments/${ASSIGNMENT_ID}`,
    "/notifications",
    "/messages",
    "/settings/calendar",
    "/settings/profile",
    "/settings/drive",
    "/settings/security",
    "/admin/verifications",
    "/dashboard",
    "/dashboard/review",
    "/dashboard/schedule",
    "/dashboard/sessions",
    "/dashboard/leave-requests",
    "/classes/ti-2024",
    "/classes/ti-2024/assignments",
    "/classes/ti-2024/attendance",
    "/classes/ti-2024/courses",
    "/classes/ti-2024/leave-requests",
    "/classes/ti-2024/manage",
    "/classes/ti-2024/members",
    "/classes/ti-2024/overview",
    "/classes/ti-2024/review",
    "/classes/ti-2024/schedule",
    "/classes/ti-2024/settings",
    "/classes/ti-2024/submit",
    "/dashboard/classes/ti-2024",
    "/dashboard/classes/ti-2024/leave-requests",
    "/dashboard/classes/ti-2024/manage",
  ])(
    "accepts valid app and SQL trigger path %s in both payload and sw.js",
    (path) => {
      expect(isSafeNotificationPath(path)).toBe(true);
      expect(swIsSafePath(path)).toBe(true);
    },
  );

  it.each([
    {
      label: "an external URL",
      value: `https://evil.example/assignments/${ASSIGNMENT_ID}`,
    },
    {
      label: "a protocol-relative URL",
      value: `//evil.example/assignments/${ASSIGNMENT_ID}`,
    },
    {
      label: "a backslash traversal URL",
      value: "/\\evil.example",
    },
    { label: "a path without a UUID", value: "/assignments/123" },
    {
      label: "a leave request path without a UUID",
      value: "/leave-requests/123",
    },
    { label: "an unknown class subpath", value: "/classes/ti-2024/secret" },
    { label: "a nested path", value: `/assignments/${ASSIGNMENT_ID}/edit` },
    { label: "the home page", value: "/" },
  ])("rejects $label in both payload and sw.js", ({ value }) => {
    expect(isSafeNotificationPath(value)).toBe(false);
    expect(swIsSafePath(value)).toBe(false);
  });
});
