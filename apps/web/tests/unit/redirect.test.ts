import { describe, expect, it } from "vitest";

import { buildLoginPath, safeRedirectPath } from "@/lib/security/redirect";

describe("safeRedirectPath", () => {
  it("keeps a plain internal path", () => {
    expect(safeRedirectPath("/assignments/abc?tab=details")).toBe(
      "/assignments/abc?tab=details",
    );
  });

  it("falls back when the value is missing", () => {
    expect(safeRedirectPath(null)).toBe("/assignments");
    expect(safeRedirectPath(undefined)).toBe("/assignments");
    expect(safeRedirectPath("")).toBe("/assignments");
  });

  it.each([
    "https://evil.example",
    "http://evil.example/path",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "assignments",
  ])("rejects the open-redirect attempt %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/assignments");
  });

  it("rejects control characters", () => {
    expect(safeRedirectPath("/assignments\nSet-Cookie: x=1")).toBe(
      "/assignments",
    );
  });

  it("rejects an over-long destination", () => {
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBe("/assignments");
  });

  it("never redirects back into the auth flow", () => {
    expect(safeRedirectPath("/login")).toBe("/assignments");
    expect(safeRedirectPath("/auth/callback")).toBe("/assignments");
  });

  it("honours a custom fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/")).toBe("/");
  });
});

describe("buildLoginPath", () => {
  it("encodes the destination", () => {
    expect(buildLoginPath("/my-assignments/abc/edit")).toBe(
      "/login?next=%2Fmy-assignments%2Fabc%2Fedit",
    );
  });

  it("sanitizes a hostile destination before encoding", () => {
    expect(buildLoginPath("https://evil.example")).toBe(
      "/login?next=%2Fassignments",
    );
  });
});
