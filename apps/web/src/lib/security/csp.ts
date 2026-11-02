const FALLBACK_SUPABASE_ORIGIN = "https://*.supabase.co";

export function createCspNonce(): string {
  return btoa(crypto.randomUUID());
}

function supabaseOrigins(): { http: string; socket: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const http = url.startsWith("https://") ? url : FALLBACK_SUPABASE_ORIGIN;

  return { http, socket: http.replace("https://", "wss://") };
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
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
