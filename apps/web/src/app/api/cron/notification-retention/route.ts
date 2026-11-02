import { apiError, apiSuccess } from "@/lib/api/responses";
import { resolveNotificationRetentionDays } from "@/lib/push/retention";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

// Purges personal data based on the clock, so it can never be prerendered.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deletes terminal reminder-ledger rows older than the retention window.
 * Pending and processing rows stay so the scheduler can finish them.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError(401, "unauthorized", "Invalid scheduler credentials.");
  }

  if (!isServiceRoleConfigured()) {
    return apiError(
      503,
      "service_unavailable",
      "The service role key is not configured on this deployment.",
    );
  }

  const retentionDays = resolveNotificationRetentionDays();

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc(
      "purge_notification_deliveries",
      { p_retention_days: retentionDays },
    );

    if (error) {
      throw error;
    }

    const purged = data ?? 0;

    // Only an aggregate count is logged; no user ids or assignment titles.
    console.info("[cron] notification retention", { retentionDays, purged });

    return apiSuccess({ retentionDays, purged });
  } catch (error) {
    console.error("[cron] notification retention run failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "unknown",
    });

    return apiError(500, "internal_error", "The retention run failed.");
  }
}
