import { afterEach, describe, expect, it, vi } from "vitest";

const probeStorageMock = vi.fn();

vi.mock("@/lib/db/developer-operations", () => ({
  probeDeveloperStorage: (...args: unknown[]) => probeStorageMock(...args),
}));

import { getDeveloperIntegrationStatus } from "@/lib/observability/integration-status";

function setEnv(values: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

const CLEAN_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  DEVELOPER_EMAILS: undefined,
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
  RATE_LIMIT_SALT: undefined,
  VAPID_PUBLIC_KEY: undefined,
  VAPID_PRIVATE_KEY: undefined,
  VAPID_SUBJECT: undefined,
  GOOGLE_CALENDAR_CLIENT_ID: undefined,
  GOOGLE_CALENDAR_CLIENT_SECRET: undefined,
  GOOGLE_CALENDAR_REDIRECT_URI: undefined,
  GOOGLE_TOKEN_ENCRYPTION_KEY: undefined,
  CRON_SECRET: undefined,
  NEXT_PUBLIC_SITE_URL: undefined,
};

afterEach(() => {
  setEnv(CLEAN_ENV);
  probeStorageMock.mockReset();
});

describe("getDeveloperIntegrationStatus", () => {
  it("reports every check as not configured without environment values", async () => {
    const status = await getDeveloperIntegrationStatus();

    expect(status.allConfigured).toBe(false);
    expect(status.checks.every((check) => check.ok)).toBe(false);
  });

  it("reports a fully configured deployment and probes storage", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-value-1234",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      DEVELOPER_EMAILS: "developer@example.com",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      RATE_LIMIT_SALT: "salt",
      VAPID_PUBLIC_KEY: "vapid-public",
      VAPID_PRIVATE_KEY: "vapid-private",
      VAPID_SUBJECT: "mailto:ops@example.com",
      GOOGLE_CALENDAR_CLIENT_ID: "client-id",
      GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
      GOOGLE_CALENDAR_REDIRECT_URI: "https://example.com/callback",
      GOOGLE_TOKEN_ENCRYPTION_KEY: "encryption-key",
      CRON_SECRET: "cron-secret",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    });
    probeStorageMock.mockResolvedValue({ ok: true, latencyMs: 12 });

    const status = await getDeveloperIntegrationStatus();

    expect(status.allConfigured).toBe(true);
    expect(status.checks.every((check) => check.ok)).toBe(true);
    expect(probeStorageMock).toHaveBeenCalledOnce();
  });

  it("skips the storage probe when Supabase itself is unconfigured", async () => {
    probeStorageMock.mockResolvedValue({ ok: true, latencyMs: 12 });

    const status = await getDeveloperIntegrationStatus();

    expect(probeStorageMock).not.toHaveBeenCalled();
    expect(status.allConfigured).toBe(false);
  });

  it("fails closed on a malformed developer allowlist", async () => {
    setEnv({ DEVELOPER_EMAILS: "not-an-email" });

    const status = await getDeveloperIntegrationStatus();
    const allowlistCheck = status.checks.find(
      (check) => check.id === "developer-allowlist",
    );

    expect(allowlistCheck?.ok).toBe(false);
    expect(status.allConfigured).toBe(false);
  });

  it("never includes an environment value in a check payload", async () => {
    setEnv({
      SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-role-value",
      DEVELOPER_EMAILS: "developer@example.com",
    });

    const status = await getDeveloperIntegrationStatus();
    const serialized = JSON.stringify(status);

    expect(serialized).not.toContain("super-secret-service-role-value");
    expect(serialized).not.toContain("developer@example.com");
  });
});
