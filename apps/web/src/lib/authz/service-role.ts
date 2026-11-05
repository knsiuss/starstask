import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

/**
 * Service-role access for Phase 5I write paths.
 *
 * Used only after the caller has been authorized with the request-scoped
 * client (session + `has_class_permission` / `is_platform_admin`). The
 * service-role client bypasses RLS, so every query it runs must re-apply the
 * tenant filters explicitly (university_id / class_id) rather than rely on
 * policy scoping. The key never leaves the server.
 */
export function requireServiceRoleClient() {
  if (!isServiceRoleConfigured()) {
    throw new ApiError(
      503,
      "service_unavailable",
      "This action is temporarily unavailable. Please try again later.",
    );
  }

  return createSupabaseAdminClient();
}
