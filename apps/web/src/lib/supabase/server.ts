import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { getSupabaseConfig } from "@/lib/env/public";
import type { Database } from "@/types/database";

/**
 * Request-scoped Supabase client for Server Components, Server Actions, and
 * Route Handlers.
 *
 * Web clients use cookies (sessions are read from cookies; refreshed cookies
 * are written back when the runtime allows it; `proxy.ts` owns the refresh).
 * Native clients that send `Authorization: Bearer <access_token>` get the same
 * treatment but with a token-scoped client — every query runs under the
 * native caller's RLS, so web cookie behavior is unchanged while Android's
 * session works server-side as-is.
 */
export async function createSupabaseServerClient() {
  const headerStore = await headers();
  const { url, key } = getSupabaseConfig();

  const authHeader = headerStore.get("authorization");

  if (authHeader) {
    const [scheme, ...rest] = authHeader.trim().split(/\s+/);

    if (scheme?.toLowerCase() === "bearer") {
      const token = rest.join(" ").trim();

      if (token.length > 0) {
        return createServerClient<Database>(url, key, {
          cookies: {
            getAll() {
              return [];
            },
            setAll() {
              // Native clients do not share the web cookie jar.
            },
          },
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });
      }
    }
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Read-only cookie context; proxy.ts owns session refresh.
        }
      },
    },
  });
}
