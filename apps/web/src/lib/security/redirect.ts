const MAX_REDIRECT_LENGTH = 512;
const INTERNAL_ORIGIN = "https://starstask.internal";

/**
 * Returns a safe internal path for post-login navigation.
 *
 * Rejects absolute URLs, protocol-relative URLs, backslash tricks, control
 * characters, and auth routes so a crafted `?next=` can never turn into an open
 * redirect or a login loop.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/assignments",
): string {
  if (!value) {
    return fallback;
  }

  const candidate = value.trim();

  if (
    candidate.length === 0 ||
    candidate.length > MAX_REDIRECT_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }

  if (parsed.origin !== INTERNAL_ORIGIN) {
    return fallback;
  }

  if (parsed.pathname === "/login" || parsed.pathname.startsWith("/auth")) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Builds the login URL for a protected path, preserving the destination. */
export function buildLoginPath(nextPath: string): string {
  return `/login?next=${encodeURIComponent(safeRedirectPath(nextPath, "/assignments"))}`;
}
