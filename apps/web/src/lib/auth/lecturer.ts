import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in user may use lecturer surfaces.
 *
 * Backed by the `is_lecturer()` RPC (20270114000000_university_roles.sql).
 * Cosmetic navigation and page gates share one cached call per request;
 * every protected route still re-checks identity server-side. Fails closed
 * when unconfigured or on error.
 */
export const isLecturer = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "is_lecturer" as never,
    {} as never,
  );

  if (error) {
    console.error("[lecturer] role check failed", { code: error.code });
    return false;
  }

  return data === true;
});
