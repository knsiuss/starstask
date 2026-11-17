import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DataAccessError } from "@/lib/db/assignments";

/**
 * Production-Scale Hardening Plan §1 — request-scope class memberships.
 *
 * A 30-second TTL cache of authorization data across requests is NOT used:
 * it would keep a revoked member authorized for up to 30s and risks key
 * confusion leaking one tenant's class ids to another user. Instead this
 * uses React `cache()`: resolved once per request, discarded when the
 * request ends, zero cross-user leak by construction.
 *
 * RLS still governs row visibility on every query. These ids are a UI
 * convenience (skip rendering inaccessible classes); they are never a
 * substitute for the database predicates (`is_class_member()` /
 * `has_class_permission()`), which remain the source of truth.
 */

/** Pure: dedupe + drop nulls + sort a raw class-id column. Unit-tested. */
export function summarizeClassIds(
  rows: Array<{ class_id: string | null }>,
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.class_id) {
      ids.add(row.class_id);
    }
  }
  return [...ids].sort();
}

/** Class ids the caller belongs to in this request (empty when signed out). */
export const getMyClassIds = cache(async (): Promise<string[]> => {
  const session = await getSessionUser();

  if (!session) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", session.user.id);

  if (error) {
    throw new DataAccessError("Could not load your classes", error.code);
  }

  return summarizeClassIds((data ?? []) as Array<{ class_id: string }>);
});
