import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { getSupabaseConfig } from "@/lib/env/public";
import type { Database } from "@/types/database";

const workerClientStore = new AsyncLocalStorage<SupabaseClient<Database>>();

/**
 * Runs a background worker callback with a pre-authorized service-role client
 * scoped to the async call chain so cookie-less QStash jobs can read/write
 * RLS-protected export data after signature and job-ownership verification.
 */
export function runWithWorkerSupabaseClient<T>(
  client: SupabaseClient<Database>,
  fn: () => Promise<T>,
): Promise<T> {
  return workerClientStore.run(client, fn);
}

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
  const workerClient = workerClientStore.getStore();

  if (workerClient) {
    return workerClient;
  }

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
