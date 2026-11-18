import { apiError, apiSuccess } from "@/lib/api/responses";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Marks unrecorded students in expired attendance meetings as absent unless
 * they have an approved or forwarded leave request covering the meeting date.
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

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "auto_cutoff_expired_attendance_meetings" as never,
    { p_cutoff_minutes: 15 } as never,
  );

  if (error) {
    console.error("[cron] attendance auto-cutoff failed", {
      code: error.code,
      message: error.message,
    });

    return apiError(
      500,
      "cutoff_failed",
      "Could not execute attendance auto-cutoff.",
    );
  }

  return apiSuccess({ processed: data ?? null });
}
