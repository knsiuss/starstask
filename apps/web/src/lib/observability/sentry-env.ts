/**
 * Sentry enablement helpers. Sentry is opt-in: without
 * `NEXT_PUBLIC_SENTRY_DSN` the SDK initialises as a no-op, so behaviour is
 * identical to having no Sentry installed. The DSN is a public client key
 * and is safe to ship in the browser bundle.
 */

export function isSentryConfigured(): boolean {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return typeof dsn === "string" && dsn.trim().length > 0;
}

export function getSentryDsn(): string | undefined {
  if (!isSentryConfigured()) {
    return undefined;
  }

  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
}

export function getSentryEnvironment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development"
  );
}

/**
 * Origin of the Sentry ingest endpoint derived from the DSN (for CSP
 * `connect-src`). Returns null when Sentry is off or the DSN is malformed.
 */
export function getSentryIngestOrigin(): string | null {
  const dsn = getSentryDsn();

  if (!dsn) {
    return null;
  }

  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}
