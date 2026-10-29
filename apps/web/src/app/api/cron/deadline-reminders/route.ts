import { apiError, apiSuccess } from "@/lib/api/responses";
import { getPushConfig } from "@/lib/push/config";
import { runDeadlineReminders } from "@/lib/push/scheduler";
import { createWebPushSender } from "@/lib/push/sender";
import { createSupabaseReminderStore } from "@/lib/push/store";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

// The scheduler must run per request: it reads the current time and writes
// delivery rows, so it can never be prerendered or cached.
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
    const summary = await runDeadlineReminders({
      store: createSupabaseReminderStore(),
      sender: createWebPushSender(config),
      limit: 100,
    });

    // Only aggregate counters are logged; endpoints and payloads never are.
    console.info("[cron] deadline reminders", summary);

    return apiSuccess(summary);
  } catch (error) {
    console.error("[cron] deadline reminder run failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "unknown",
    });

    return apiError(500, "internal_error", "The reminder run failed.");
  }
}
