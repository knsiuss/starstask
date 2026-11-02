import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getClaims: mocks.getClaims,
      getUser: mocks.getUser,
    },
  })),
}));

vi.mock("@/lib/env/public", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseConfig: () => ({
    url: "https://test.supabase.co",
    key: "test-anon-key",
  }),
}));

import { updateSession } from "@/lib/supabase/proxy";

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "https://app.test"));
}

describe("updateSession", () => {
  beforeEach(() => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("verifies the session with getClaims and not getUser", async () => {
    await updateSession(createRequest("/dashboard"));

    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("lets an anonymous request continue without redirecting", async () => {
    const response = await updateSession(createRequest("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an allowlisted developer away from student workspace pages", async () => {
    vi.stubEnv("DEVELOPER_EMAILS", "dev@example.test");
    mocks.getClaims.mockResolvedValue({
      data: { claims: { email: "dev@example.test" }, error: null },
    });

    const response = await updateSession(createRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.test/developer");
  });

  it("does not redirect a developer on non-student paths", async () => {
    vi.stubEnv("DEVELOPER_EMAILS", "dev@example.test");
    mocks.getClaims.mockResolvedValue({
      data: { claims: { email: "dev@example.test" }, error: null },
    });

    const response = await updateSession(createRequest("/developer"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
