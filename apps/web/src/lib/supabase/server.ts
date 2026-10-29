import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/env/public";
import type { Database } from "@/types/database";

/**
 * Request-scoped Supabase client for Server Components, Server Actions, and
 * Route Handlers. Sessions are read from cookies; refreshed cookies are written
 * back when the runtime allows it.
 *
 * `setAll` may throw inside a Server Component because cookies are read-only
 * there. That is expected: `proxy.ts` performs the refresh and writes cookies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

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
