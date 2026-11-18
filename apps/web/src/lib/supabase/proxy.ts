import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  DEVELOPER_HOME_PATH,
  isAllowlistedDeveloperEmail,
  isStudentWorkspacePath,
  parseDeveloperEmails,
} from "@starstask/shared";

import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "@/types/database";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_EXEMPT_EXACT_PATHS = new Set([
  "/api/csp-report",
  "/api/attendance/sync",
]);

function isCsrfExemptPath(pathname: string): boolean {
  return (
    CSRF_EXEMPT_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/api/worker/") ||
    pathname.startsWith("/api/cron/")
  );
}

function isSameOriginApiRequest(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    return true;
  }

  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  if (isCsrfExemptPath(pathname)) {
    return true;
  }

  const secFetchSite = request.headers
    .get("sec-fetch-site")
    ?.trim()
    .toLowerCase();

  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "none"
  ) {
    return false;
  }

  const originHeader = request.headers.get("origin");

  if (originHeader !== null) {
    try {
      const parsedOrigin = new URL(originHeader);

      if (parsedOrigin.origin !== request.nextUrl.origin) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Refreshes the Supabase session on every matched request and mirrors the
 * refreshed cookies onto the response.
 *
 * This runs in the Next.js proxy (formerly middleware). Authorization is never
 * decided here; protected pages and API routes verify the user independently.
 * The single exception below is a routing rule, not an authorization check: a
 * developer account is bounced from student-only pages to the console, which
 * re-verifies the allowlist on every request itself.
 *
 * CSRF security relies on SameSite=Lax + Secure (HTTPS) session cookies (note:
 * `@supabase/ssr` browser cookies are not HttpOnly because the client SDK reads
 * them) combined with same-origin `Origin` / `Sec-Fetch-Site` enforcement on
 * state-changing `/api/` requests.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  if (!isSameOriginApiRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        // Supabase supplies private/no-store cache headers for auth responses.
        for (const [headerName, headerValue] of Object.entries(headers)) {
          response.headers.set(headerName, headerValue);
        }
      },
    },
  });

  // getClaims() verifies the JWT signature and refreshes an expiring session.
  // With asymmetric signing keys the verification is local (cached JWKS), so
  // this no longer repeats the network round-trip that pages make with
  // getUser(). Pages keep that getUser() call as their authoritative check.
  // getSession() alone is not a trust boundary.
  //
  // Supabase outage (or an unparseable cookie) must not 500 every route —
  // let the request through; pages still re-verify identity before trusting
  // anything, and the sign-in page stays reachable to recover.
  let claims: { email?: string } | undefined;

  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    claims = claimsData?.claims as { email?: string } | undefined;
  } catch (error) {
    console.error("[proxy] getClaims failed", {
      name: error instanceof Error ? error.name : typeof error,
      path: request.nextUrl.pathname,
    });
    return response;
  }

  const allowlist = parseDeveloperEmails(process.env.DEVELOPER_EMAILS);

  if (
    isAllowlistedDeveloperEmail(claims?.email, allowlist) &&
    isStudentWorkspacePath(request.nextUrl.pathname)
  ) {
    const redirectResponse = NextResponse.redirect(
      new URL(DEVELOPER_HOME_PATH, request.url),
    );

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return response;
}
