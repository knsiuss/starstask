import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/auth/session";

const {
  configuredMock,
  enforceRateLimitMock,
  getAssignmentDetailMock,
  getSessionUserMock,
  listAssignmentsMock,
  redirectMock,
} = vi.hoisted(() => ({
  configuredMock: vi.fn(() => true),
  enforceRateLimitMock: vi.fn(),
  getAssignmentDetailMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  listAssignmentsMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: getSessionUserMock }));

vi.mock("@/lib/db/assignments", () => ({
  getAssignmentDetail: getAssignmentDetailMock,
  listAssignments: listAssignmentsMock,
}));

vi.mock("@/lib/env/public", () => ({ isSupabaseConfigured: configuredMock }));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  getClientIdentifier: vi.fn(() => "anonymous"),
}));

vi.mock("@/lib/observability/events", () => ({
  recordAppActivity: vi.fn(),
  recordErrorActivity: vi.fn(),
}));

import { GET as listAssignmentsRoute } from "@/app/api/assignments/route";
import { GET as assignmentDetailRoute } from "@/app/api/assignments/[id]/route";
import { requireAssignmentPageSession } from "@/lib/auth/assignment-access";

const assignmentId = "00000000-0000-4000-8000-000000000000";
const signedInSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    app_metadata: {},
    user_metadata: {},
  },
  profile: null,
} satisfies SessionUser;

beforeEach(() => {
  configuredMock.mockReturnValue(true);
  enforceRateLimitMock.mockReset();
  getAssignmentDetailMock.mockReset();
  getSessionUserMock.mockReset();
  listAssignmentsMock.mockReset();
  redirectMock.mockClear();
});

describe("assignment privacy", () => {
  it("redirects guests before loading an assignment page", async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(
      requireAssignmentPageSession(`/assignments/${assignmentId}`),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/login?next=%2Fassignments%2F${assignmentId}`,
    );

    expect(getAssignmentDetailMock).not.toHaveBeenCalled();
  });

  it("preserves the setup screen when authentication is not configured", async () => {
    configuredMock.mockReturnValue(false);

    await expect(
      requireAssignmentPageSession("/assignments"),
    ).resolves.toBeNull();
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it("allows a verified session", async () => {
    getSessionUserMock.mockResolvedValue(signedInSession);

    await expect(requireAssignmentPageSession("/assignments")).resolves.toBe(
      signedInSession,
    );
  });

  it("returns 401 from the list API without querying assignments", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const response = await listAssignmentsRoute(
      new Request("https://starstask.test/api/assignments"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(listAssignmentsMock).not.toHaveBeenCalled();
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
  });

  it("returns 401 from the detail API without querying the assignment", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const response = await assignmentDetailRoute(
      new Request(`https://starstask.test/api/assignments/${assignmentId}`),
      { params: Promise.resolve({ id: assignmentId }) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getAssignmentDetailMock).not.toHaveBeenCalled();
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
  });

  it("uses a private response for a signed-in list request", async () => {
    getSessionUserMock.mockResolvedValue(signedInSession);
    listAssignmentsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    });

    const response = await listAssignmentsRoute(
      new Request("https://starstask.test/api/assignments"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(listAssignmentsMock).toHaveBeenCalledOnce();
  });
});
