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
});

describe("createCspNonce", () => {
  it("returns a fresh base64 value on every call", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});
