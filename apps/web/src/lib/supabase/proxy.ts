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

/**
 * Refreshes the Supabase session on every matched request and mirrors the
 * refreshed cookies onto the response.
 *
 * This runs in the Next.js proxy (formerly middleware). Authorization is never
 * decided here; protected pages and API routes verify the user independently.
 * The single exception below is a routing rule, not an authorization check: a
 * developer account is bounced from student-only pages to the console, which
 * re-verifies the allowlist on every request itself.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
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

  // getUser() validates the access token with Supabase Auth and triggers a
  // refresh when needed. getSession() alone is not a trust boundary.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = parseDeveloperEmails(process.env.DEVELOPER_EMAILS);

  if (
    isAllowlistedDeveloperEmail(user?.email, allowlist) &&
    isStudentWorkspacePath(request.nextUrl.pathname)
  ) {
    return NextResponse.redirect(new URL(DEVELOPER_HOME_PATH, request.url));
  }

  return response;
}
