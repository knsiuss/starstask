import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildContentSecurityPolicy, createCspNonce } from "@/lib/security/csp";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildContentSecurityPolicy", () => {
  it("binds scripts to the nonce instead of unsafe-inline", () => {
    const policy = buildContentSecurityPolicy("test-nonce");
    const scriptSrc = policy
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(scriptSrc).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("allows eval only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(buildContentSecurityPolicy("nonce")).toContain("'unsafe-eval'");
  });

  it("adds upgrade-insecure-requests only in production", () => {
    expect(buildContentSecurityPolicy("nonce")).toContain(
      "upgrade-insecure-requests",
    );

    vi.stubEnv("NODE_ENV", "development");
    expect(buildContentSecurityPolicy("nonce")).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("derives the Supabase origins from the public URL", () => {
    const policy = buildContentSecurityPolicy("nonce");

    expect(policy).toContain("connect-src 'self' https://example.supabase.co");
    expect(policy).toContain("wss://example.supabase.co");
    expect(policy).toContain(
      "img-src 'self' data: blob: https://example.supabase.co",
    );
    expect(policy).toContain("frame-src 'self' https://example.supabase.co");
  });

  it("falls back to the Supabase wildcard for a non-https URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    expect(buildContentSecurityPolicy("nonce")).toContain(
      "https://*.supabase.co",
    );
  });

  it("keeps the OAuth form target and clickjacking guard", () => {
    const policy = buildContentSecurityPolicy("nonce");

    expect(policy).toContain("form-action 'self' https://accounts.google.com");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("adds no third-party origins when observability is unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    const policy = buildContentSecurityPolicy("nonce");

    expect(policy).not.toContain("sentry");
    expect(policy).not.toContain("posthog");
  });

  it("adds the Sentry ingest origin when a DSN is configured", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://abc@o123.ingest.sentry.io/456",
    );

    expect(buildContentSecurityPolicy("nonce")).toContain(
      "https://o123.ingest.sentry.io",
    );
  });

  it("ignores a malformed Sentry DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "not-a-url");

    expect(buildContentSecurityPolicy("nonce")).not.toContain("sentry");
  });

  it("adds the PostHog host when a key is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    expect(buildContentSecurityPolicy("nonce")).toContain(
      "https://us.i.posthog.com",
    );
  });

  it("adds the configured PostHog host origin", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");

    expect(buildContentSecurityPolicy("nonce")).toContain(
      "https://eu.i.posthog.com",
    );
  });
});

describe("createCspNonce", () => {
  it("returns a fresh base64 value on every call", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});
