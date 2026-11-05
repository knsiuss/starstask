import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryIngestOrigin,
  isSentryConfigured,
} from "@/lib/observability/sentry-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSentryConfigured", () => {
  it("is false without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    expect(isSentryConfigured()).toBe(false);
  });

  it("is false for a whitespace-only DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "   ");

    expect(isSentryConfigured()).toBe(false);
  });

  it("is true when a DSN is set", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://abc@o123.ingest.sentry.io/456",
    );

    expect(isSentryConfigured()).toBe(true);
  });
});

describe("getSentryDsn", () => {
  it("returns undefined when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    expect(getSentryDsn()).toBeUndefined();
  });

  it("returns the trimmed DSN", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "  https://abc@o123.ingest.sentry.io/456  ",
    );

    expect(getSentryDsn()).toBe("https://abc@o123.ingest.sentry.io/456");
  });
});

describe("getSentryEnvironment", () => {
  it("prefers the server environment override", () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "staging");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "production");

    expect(getSentryEnvironment()).toBe("staging");
  });

  it("falls back to the public override then NODE_ENV", () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "preview");

    expect(getSentryEnvironment()).toBe("preview");
  });
});

describe("getSentryIngestOrigin", () => {
  it("returns null without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    expect(getSentryIngestOrigin()).toBeNull();
  });

  it("returns the DSN origin", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://abc@o123.ingest.de.sentry.io/456",
    );

    expect(getSentryIngestOrigin()).toBe("https://o123.ingest.de.sentry.io");
  });

  it("returns null for a malformed DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "not-a-url");

    expect(getSentryIngestOrigin()).toBeNull();
  });
});
