import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, redirectMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { isStudentWorkspacePath } from "@starstask/shared";
import { resolveSignedInHomePath } from "@/lib/auth/developer";

beforeEach(() => {
  process.env.DEVELOPER_EMAILS = "developer@example.com";
});

afterEach(() => {
  delete process.env.DEVELOPER_EMAILS;
});

describe("isStudentWorkspacePath", () => {
  it("matches student workspace pages and their subpaths", () => {
    const paths = [
      "/dashboard",
      "/dashboard/classes/slug",
      "/assignments",
      "/assignments/abc",
      "/classes",
      "/classes/join",
      "/leave-requests",
      "/leave-requests/abc/edit",
      "/sessions",
      "/sessions/abc",
      "/submit",
      "/my-assignments",
      "/my-assignments/abc/edit",
    ];

    for (const path of paths) {
      expect(isStudentWorkspacePath(path), path).toBe(true);
    }
  });

  it("does not match console, admin, settings, or public paths", () => {
    const paths = [
      "/developer",
      "/developer/logs",
      "/developer/users",
      "/admin",
      "/settings/profile",
      "/login",
      "/invite/token",
      "/api/developer/overview",
      "/",
    ];

    for (const path of paths) {
      expect(isStudentWorkspacePath(path), path).toBe(false);
    }
  });

  it("does not match prefixes that only share leading characters", () => {
    expect(isStudentWorkspacePath("/assignments-extra")).toBe(false);
    expect(isStudentWorkspacePath("/dashboardx")).toBe(false);
  });
});

describe("resolveSignedInHomePath", () => {
  it("sends allowlisted developers to the console", () => {
    expect(resolveSignedInHomePath("Developer@Example.com")).toBe(
      "/developer",
    );
  });

  it("sends everyone else to the workspace dashboard", () => {
    expect(resolveSignedInHomePath("student@example.com")).toBe("/dashboard");
    expect(resolveSignedInHomePath(null)).toBe("/dashboard");
  });

  it("fails closed to the dashboard when the allowlist is unconfigured", () => {
    delete process.env.DEVELOPER_EMAILS;

    expect(resolveSignedInHomePath("developer@example.com")).toBe("/dashboard");
  });

  it("fails closed to the dashboard when the allowlist is malformed", () => {
    process.env.DEVELOPER_EMAILS = "not-an-email";

    expect(resolveSignedInHomePath("developer@example.com")).toBe("/dashboard");
  });
});
