import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in user is on the beta tester allowlist.
 *
 * Beta status is an allowlist, not an authorization role: routes still
 * enforce their own permissions. Cached per request so layout and page
 * checks share one RPC. Fails closed (false) when unconfigured or when
 * the check errors, so a database hiccup never widens a beta surface.
 */
export const isBetaTester = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_beta_tester");

  if (error) {
    console.error("[beta] allowlist check failed", { code: error.code });
    return false;
  }

  return data === true;
});
