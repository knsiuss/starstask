import { describe, expect, it } from "vitest";

import { isSafeNotificationPath } from "@/lib/push/payload";

/**
 * Verification notifications may open the student's profile or the admin
 * queue. Nothing else — no evidence path, no external origin.
 */
describe("isSafeNotificationPath for verification", () => {
  it("allows the two verification destinations", () => {
    expect(isSafeNotificationPath("/settings/profile")).toBe(true);
    expect(isSafeNotificationPath("/admin/verifications")).toBe(true);
  });

  it("does not allow arbitrary sub-paths", () => {
    expect(isSafeNotificationPath("/admin/verifications/123")).toBe(false);
    expect(isSafeNotificationPath("/settings/profile/evidence")).toBe(false);
  });

  it("rejects external and traversal-like values", () => {
    expect(isSafeNotificationPath("//evil.test/settings/profile")).toBe(false);
    expect(isSafeNotificationPath("https://evil.test/settings/profile")).toBe(
      false,
    );
    expect(isSafeNotificationPath("/settings/profile/../admin")).toBe(false);
  });
});
