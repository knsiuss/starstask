import { apiError, apiSuccess } from "@/lib/api/responses";
import { createSupabaseNotificationEventStore } from "@/lib/push/event-store";
import { runNotificationEvents } from "@/lib/push/event-scheduler";
import { getPushConfig } from "@/lib/push/config";
import { createWebPushSender } from "@/lib/push/sender";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

// Event delivery reads the current queue and writes outcomes per request.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError(401, "unauthorized", "Invalid scheduler credentials.");
  }

  const config = getPushConfig();

  if (!config || !isServiceRoleConfigured()) {
    return apiError(
      503,
      "push_unavailable",
      "Push notifications are not configured on this deployment.",
    );
  }

  try {
    const summary = await runNotificationEvents({
      store: createSupabaseNotificationEventStore(),
      sender: createWebPushSender(config),
      limit: 100,
    });

    // Only aggregate counters are logged; payloads never are.
    console.info("[cron] notification events", summary);

    return apiSuccess(summary);
  } catch (error) {
    console.error("[cron] notification event run failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "unknown",
    });

    return apiError(500, "internal_error", "The event run failed.");
  }
}
