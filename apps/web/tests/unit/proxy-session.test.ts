import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  setAllCookies: [] as Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }>,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      options: {
        cookies: {
          setAll: (
            cookies: Array<{
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }>,
            headers: Record<string, string>,
          ) => void;
        };
      },
    ) => ({
      auth: {
        getClaims: async () => {
          if (mocks.setAllCookies.length > 0) {
            options.cookies.setAll(mocks.setAllCookies, {});
          }

          return mocks.getClaims();
        },
        getUser: mocks.getUser,
      },
    }),
  ),
}));

vi.mock("@/lib/env/public", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseConfig: () => ({
    url: "https://test.supabase.co",
    key: "test-anon-key",
  }),
}));

import { updateSession } from "@/lib/supabase/proxy";

function createRequest(
  pathname: string,
  init?: { method?: string; headers?: Record<string, string> },
): NextRequest {
  return new NextRequest(new URL(pathname, "https://app.test"), init);
}

describe("updateSession", () => {
  beforeEach(() => {
    mocks.setAllCookies = [];
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("verifies the session with getClaims and not getUser", async () => {
    await updateSession(createRequest("/app"));

    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("lets an anonymous request continue without redirecting", async () => {
    const response = await updateSession(createRequest("/app"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an allowlisted developer away from student workspace pages", async () => {
    vi.stubEnv("DEVELOPER_EMAILS", "dev@example.test");
    mocks.getClaims.mockResolvedValue({
      data: { claims: { email: "dev@example.test" }, error: null },
    });

    const response = await updateSession(createRequest("/app"));

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

  it("copies refreshed session cookies onto the developer redirect response", async () => {
    vi.stubEnv("DEVELOPER_EMAILS", "dev@example.test");
    mocks.setAllCookies = [
      {
        name: "sb-access-token",
        value: "refreshed-jwt",
        options: { path: "/", sameSite: "lax", secure: true },
      },
    ];
    mocks.getClaims.mockResolvedValue({
      data: { claims: { email: "dev@example.test" }, error: null },
    });

    const response = await updateSession(createRequest("/app"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.test/developer");
    expect(response.cookies.get("sb-access-token")?.value).toBe(
      "refreshed-jwt",
    );
  });

  it("rejects cross-site state-changing API requests with 403", async () => {
    const crossSite = await updateSession(
      createRequest("/api/dm/conversations", {
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://evil.test",
        },
      }),
    );

    expect(crossSite.status).toBe(403);

    const mismatchedOrigin = await updateSession(
      createRequest("/api/dm/keys/me", {
        method: "PUT",
        headers: {
          origin: "https://evil.test",
        },
      }),
    );

    expect(mismatchedOrigin.status).toBe(403);

    const nullOrigin = await updateSession(
      createRequest("/api/dm/devices/dev-1", {
        method: "DELETE",
        headers: { origin: "null" },
      }),
    );

    expect(nullOrigin.status).toBe(403);
  });

  it("allows same-origin, non-browser, GET, and webhook/cron/sync API requests", async () => {
    const sameOrigin = await updateSession(
      createRequest("/api/dm/conversations", {
        method: "POST",
        headers: {
          origin: "https://app.test",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    const nonBrowser = await updateSession(
      createRequest("/api/dm/conversations", {
        method: "POST",
        headers: { authorization: "Bearer native-token" },
      }),
    );
    const getCrossSite = await updateSession(
      createRequest("/api/dm/conversations", {
        method: "GET",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    const workerWebhook = await updateSession(
      createRequest("/api/worker/export", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    const cronEndpoint = await updateSession(
      createRequest("/api/cron/push-dispatch", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    const cspReport = await updateSession(
      createRequest("/api/csp-report", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    const attendanceSync = await updateSession(
      createRequest("/api/attendance/sync", {
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://extension.example",
        },
      }),
    );

    for (const res of [
      sameOrigin,
      nonBrowser,
      getCrossSite,
      workerWebhook,
      cronEndpoint,
      cspReport,
      attendanceSync,
    ]) {
      expect(res.status).toBe(200);
    }
  });
});
