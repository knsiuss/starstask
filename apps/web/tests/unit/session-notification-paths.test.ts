import { describe, expect, it } from "vitest";

import { isSafeNotificationPath } from "@/lib/push/payload";

const SESSION_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";

describe("isSafeNotificationPath for sessions", () => {
  it("allows the session list and calendar settings", () => {
    expect(isSafeNotificationPath("/sessions")).toBe(true);
    expect(isSafeNotificationPath("/settings/calendar")).toBe(true);
  });

  it("allows a session detail path with a UUID", () => {
    expect(isSafeNotificationPath(`/sessions/${SESSION_ID}`)).toBe(true);
    expect(
      isSafeNotificationPath(`/sessions/${SESSION_ID.toUpperCase()}`),
    ).toBe(true);
  });

  it("rejects a session path that is not a UUID", () => {
    expect(isSafeNotificationPath("/sessions/123")).toBe(false);
    expect(isSafeNotificationPath("/sessions/midterm-review")).toBe(false);
    expect(isSafeNotificationPath("/sessions/..%2Fadmin")).toBe(false);
  });

  it("rejects a session path with a trailing segment", () => {
    expect(isSafeNotificationPath(`/sessions/${SESSION_ID}/edit`)).toBe(false);
  });

  it("still rejects external and protocol-relative URLs", () => {
    expect(isSafeNotificationPath("//evil.example.com/sessions")).toBe(false);
    expect(isSafeNotificationPath("https://evil.example.com/sessions")).toBe(
      false,
    );
    expect(isSafeNotificationPath("javascript:alert(1)")).toBe(false);
  });
});
