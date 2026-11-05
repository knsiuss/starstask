import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upstash = vi.hoisted(() => ({
  fromEnv: vi.fn(() => ({})),
  fixedWindow: vi.fn(() => ({})),
  created: vi.fn(),
  limit: vi.fn(),
}));

const envState = vi.hoisted(() => ({ configured: true }));

const supabaseRpc = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: upstash.fromEnv },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static fixedWindow = upstash.fixedWindow;

    constructor(config: unknown) {
      upstash.created(config);
    }

    limit(key: string) {
      return upstash.limit(key);
    }
  }

  return { Ratelimit };
});

vi.mock("@/lib/env/public", () => ({
  isSupabaseConfigured: () => envState.configured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve({ rpc: supabaseRpc }),
}));

async function loadModule(): Promise<
  typeof import("@/lib/security/rate-limit")
> {
  return import("@/lib/security/rate-limit");
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    action: "test:action",
    identifier: "user-1",
    limit: 10,
    windowSeconds: 60,
    ...overrides,
  };
}

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://starstask.example/api/test", { headers });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  envState.configured = true;
  upstash.fromEnv.mockClear();
  upstash.fixedWindow.mockClear();
  upstash.created.mockClear();
  upstash.limit.mockReset();
  supabaseRpc.mockReset();

  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RATE_LIMIT_SALT", "test-salt-that-is-long-enough-000000");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("TRUST_X_FORWARDED_FOR", "");

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("enforceRateLimit", () => {
  it("refuses to run in production without a salt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SALT", "");

    const { enforceRateLimit } = await loadModule();

    await expect(enforceRateLimit(rule())).rejects.toThrow("RATE_LIMIT_SALT");
  });

  it("falls back to the development salt and limits in memory", async () => {
    envState.configured = false;

    const { enforceRateLimit } = await loadModule();

    await expect(enforceRateLimit(rule({ limit: 1 }))).resolves.toBeUndefined();
    await expect(enforceRateLimit(rule({ limit: 1 }))).rejects.toMatchObject({
      status: 429,
    });
  });

  it("fails open when the Postgres counter errors", async () => {
    supabaseRpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { code: "XX000" } }),
    );

    const { enforceRateLimit } = await loadModule();

    await expect(enforceRateLimit(rule())).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[rate-limit] counter backend failed",
      expect.objectContaining({ action: "test:action" }),
    );
  });

  it("fails closed when an expensive rule cannot reach the counter", async () => {
    supabaseRpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { code: "XX000" } }),
    );

    const { enforceRateLimit } = await loadModule();

    await expect(
      enforceRateLimit(rule({ onBackendFailure: "closed" })),
    ).rejects.toMatchObject({ status: 503, code: "service_unavailable" });
  });

  it("allows the request when the Postgres counter grants a unit", async () => {
    supabaseRpc.mockImplementation(() =>
      Promise.resolve({ data: true, error: null }),
    );

    const { enforceRateLimit } = await loadModule();

    await expect(enforceRateLimit(rule())).resolves.toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rejects when the counter reports the window exhausted", async () => {
    supabaseRpc.mockImplementation(() =>
      Promise.resolve({ data: false, error: null }),
    );

    const { enforceRateLimit } = await loadModule();

    await expect(enforceRateLimit(rule())).rejects.toMatchObject({
      status: 429,
    });
  });

  it("skips limiting without a trustworthy identifier and warns once", async () => {
    const { enforceRateLimit } = await loadModule();
    const anonymous = rule({ identifier: "unknown" });

    await expect(enforceRateLimit(anonymous)).resolves.toBeUndefined();
    await expect(enforceRateLimit(anonymous)).resolves.toBeUndefined();

    expect(supabaseRpc).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("fails closed without an identifier for closed-mode rules in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { enforceRateLimit } = await loadModule();
    const closed = rule({ identifier: "unknown", onBackendFailure: "closed" });

    await expect(enforceRateLimit(closed)).rejects.toMatchObject({
      status: 503,
    });
    expect(supabaseRpc).not.toHaveBeenCalled();
  });

  it("reuses one Upstash limiter for the same window", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    upstash.limit.mockImplementation(() => Promise.resolve({ success: true }));

    const { enforceRateLimit } = await loadModule();

    await enforceRateLimit(rule());
    await enforceRateLimit(rule({ identifier: "user-2" }));

    expect(upstash.fromEnv).toHaveBeenCalledTimes(1);
    expect(upstash.fixedWindow).toHaveBeenCalledTimes(1);
    expect(upstash.limit).toHaveBeenCalledTimes(2);
  });

  it("fails closed when Upstash rejects and the rule requires it", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    upstash.limit.mockImplementation(() =>
      Promise.reject(new Error("network down")),
    );

    const { enforceRateLimit } = await loadModule();

    await expect(
      enforceRateLimit(rule({ onBackendFailure: "closed" })),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("getClientIdentifier", () => {
  it("ignores forwarded headers from an untrusted client", async () => {
    const { getClientIdentifier } = await loadModule();

    expect(
      getClientIdentifier(
        request({
          "x-forwarded-for": "203.0.113.9",
          "x-real-ip": "203.0.113.10",
        }),
      ),
    ).toBe("unknown");
  });

  it("uses the first forwarded address behind a trusted proxy", async () => {
    vi.stubEnv("TRUST_X_FORWARDED_FOR", "true");

    const { getClientIdentifier } = await loadModule();

    expect(
      getClientIdentifier(
        request({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");

    const { getClientIdentifier } = await loadModule();

    expect(getClientIdentifier(request({ "x-real-ip": "203.0.113.11" }))).toBe(
      "203.0.113.11",
    );
  });

  it("treats an unknown forwarded value as missing", async () => {
    vi.stubEnv("VERCEL", "1");

    const { getClientIdentifier } = await loadModule();

    expect(getClientIdentifier(request({ "x-forwarded-for": "unknown" }))).toBe(
      "unknown",
    );
  });
});
