import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/auth/session";

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

import {
  getDeveloperAccess,
  requireDeveloperApiAccess,
  requireDeveloperPageAccess,
} from "@/lib/auth/developer";

function sessionWithEmail(
  email: string | undefined,
  metadata: Record<string, unknown> = {},
): SessionUser {
  return {
    user: {
      id: "user-1",
      email,
      app_metadata: metadata,
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
    } as SessionUser["user"],
    profile: null,
  };
}

beforeEach(() => {
  getSessionUserMock.mockReset();
  redirectMock.mockClear();
});

afterEach(() => {
  delete process.env.DEVELOPER_EMAILS;
});

describe("developer access", () => {
  it("allows an allowlisted verified email", async () => {
    process.env.DEVELOPER_EMAILS = " Dev@Example.com , second@example.com ";
    getSessionUserMock.mockResolvedValue(sessionWithEmail("DEV@example.com"));

    const access = await getDeveloperAccess();

    expect(access.status).toBe("allowed");
  });

  it("denies a signed-in user who is not allowlisted", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com";
    getSessionUserMock.mockResolvedValue(
      sessionWithEmail("student@example.com"),
    );

    const access = await getDeveloperAccess();

    expect(access.status).toBe("denied");
  });

  it("denies an unauthenticated visitor and redirects to login", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com";
    getSessionUserMock.mockResolvedValue(null);

    await expect(requireDeveloperPageAccess("/developer")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fdeveloper");
  });

  it("fails closed when the allowlist is missing", async () => {
    delete process.env.DEVELOPER_EMAILS;
    getSessionUserMock.mockResolvedValue(
      sessionWithEmail("developer@example.com"),
    );

    const access = await getDeveloperAccess();

    expect(access.status).toBe("unconfigured");
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it("fails closed when any entry is malformed", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com,not-an-email";
    getSessionUserMock.mockResolvedValue(
      sessionWithEmail("developer@example.com"),
    );

    await expect(getDeveloperAccess()).resolves.toEqual({
      status: "unconfigured",
    });
  });

  it("does not grant access from application roles", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com";
    getSessionUserMock.mockResolvedValue(
      sessionWithEmail("admin@example.com", { role: "platform_admin" }),
    );

    await expect(getDeveloperAccess()).resolves.toEqual({ status: "denied" });
  });

  it("rejects API calls without a session with 401", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com";
    getSessionUserMock.mockResolvedValue(null);

    await expect(requireDeveloperApiAccess()).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });

  it("rejects API calls from non-allowlisted users with 403", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com";
    getSessionUserMock.mockResolvedValue(
      sessionWithEmail("student@example.com"),
    );

    await expect(requireDeveloperApiAccess()).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("rejects API calls when the allowlist is invalid with 403", async () => {
    process.env.DEVELOPER_EMAILS = "developer@example.com,";
    getSessionUserMock.mockResolvedValue(
      sessionWithEmail("developer@example.com"),
    );

    // A trailing comma is an empty segment, not a malformed address, so this
    // configuration is valid and access is allowed.
    await expect(requireDeveloperApiAccess()).resolves.toMatchObject({
      user: { email: "developer@example.com" },
    });

    process.env.DEVELOPER_EMAILS = "developer@example.com,broken";
    await expect(requireDeveloperApiAccess()).rejects.toMatchObject({
      status: 403,
    });
  });
});
