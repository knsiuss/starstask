const FALLBACK_SUPABASE_ORIGIN = "https://*.supabase.co";

export function createCspNonce(): string {
  return btoa(crypto.randomUUID());
}

function supabaseOrigin(url: string | undefined): string {
  return url && url.startsWith("https://") ? url : FALLBACK_SUPABASE_ORIGIN;
}

function supabaseOrigins(): { http: string; socket: string } {
  const http = supabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return { http, socket: http.replace("https://", "wss://") };
}

function envOrigin(value: string | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

/**
 * Extra `connect-src` origins needed by opt-in third-party services:
 * the Sentry ingest endpoint (derived from the DSN) and PostHog. Nothing is
 * added when the services are not configured.
 */
function thirdPartyOrigins(): string[] {
  const origins: string[] = [];
  const sentryOrigin = envOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);

  if (sentryOrigin) {
    origins.push(sentryOrigin);
  }

  const posthogOrigin = envOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  if (posthogOrigin) {
    origins.push(posthogOrigin);
  } else if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    origins.push("https://us.i.posthog.com");
  }

  return origins;
}

/**
 * Builds the per-request policy.
 *
 * Next.js reads the nonce from the request's `Content-Security-Policy` header
 * and attaches it to the scripts it renders, which is why `script-src` can drop
 * `'unsafe-inline'`. `style-src` still allows inline styles because the UI and
 * Next's runtime use them for layout and dev overlays.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const { http: supabaseOrigin, socket: supabaseSocket } = supabaseOrigins();
  const isProduction = process.env.NODE_ENV === "production";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin} https://*.googleusercontent.com`,
    `frame-src 'self' ${supabaseOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}${thirdPartyOrigins()
      .map((origin) => ` ${origin}`)
      .join("")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
    "report-uri /api/csp-report",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
