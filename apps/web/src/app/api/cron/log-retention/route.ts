import { apiError, apiSuccess } from "@/lib/api/responses";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

// Purges append-only log tables based on the clock, so it can never
// be prerendered.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deletes log rows older than each table's retention window:
 * audit_logs (365d), attendance verification attempts (180d),
 * activity/error events (90d). The windows match the purge function
 * defaults in the log_retention migration.
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

  try {
    const supabase = createSupabaseAdminClient();

    const purges = [
      { name: "purge_audit_logs", retentionDays: 365 },
      { name: "purge_attendance_verification_attempts", retentionDays: 180 },
      { name: "purge_app_activity_events", retentionDays: 90 },
      { name: "purge_app_error_events", retentionDays: 90 },
    ] as const;

    const results: Record<string, number> = {};

    for (const purge of purges) {
      const { data, error } = await supabase.rpc(
        purge.name as never,
        {
          p_retention_days: purge.retentionDays,
        } as never,
      );

      if (error) {
        throw error;
      }

      results[purge.name] = (data as number | null) ?? 0;
    }

    // Only aggregate counts are logged; no user ids or log contents.
    console.info("[cron] log retention", results);

    return apiSuccess(results);
  } catch (error) {
    console.error("[cron] log retention run failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "unknown",
    });

    return apiError(500, "internal_error", "The retention run failed.");
  }
}
