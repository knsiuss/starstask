import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session on every matched request and mirrors the
 * refreshed cookies onto the response.
 *
 * This runs in the Next.js proxy (formerly middleware). Authorization is never
 * decided here; protected pages and API routes verify the user independently.
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
  await supabase.auth.getUser();

  return response;
}
