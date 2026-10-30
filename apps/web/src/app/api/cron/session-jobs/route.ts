import { apiError, apiSuccess } from "@/lib/api/responses";
import { getPushConfig } from "@/lib/push/config";
import { createWebPushSender } from "@/lib/push/sender";
import { createSupabaseSessionReminderStore } from "@/lib/push/session-store";
import { runSessionReminders } from "@/lib/push/session-scheduler";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google/config";
import { processDueCalendarSyncs } from "@/features/integrations/google-calendar-service";

// Reads the clock and writes delivery rows, so it can never be prerendered.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Session background jobs.
 *
 * Two phases share one schedule because both are "keep the session feature
 * consistent" work and both are idempotent:
 *   1. session reminders  — plan, claim, and deliver 24h/3h pushes
 *   2. calendar sync      — retry mappings that are new, stale, or failed
 *
 * Either phase failing is reported in its own summary so a Calendar outage does
 * not stop reminders (and vice versa).
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

  const pushConfig = getPushConfig();

  if (!pushConfig) {
    return apiError(
      503,
      "push_unavailable",
      "Push notifications are not configured on this deployment.",
    );
  }

  let reminders: Awaited<ReturnType<typeof runSessionReminders>> | null = null;
  let calendar: Awaited<ReturnType<typeof processDueCalendarSyncs>> | null =
    null;
  const failures: string[] = [];

  try {
    reminders = await runSessionReminders({
      store: createSupabaseSessionReminderStore(),
      sender: createWebPushSender(pushConfig),
      limit: 100,
    });
  } catch (error) {
    failures.push("reminders");
    console.error("[cron] session reminder run failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  if (isGoogleCalendarConfigured()) {
    try {
      calendar = await processDueCalendarSyncs(20);
    } catch (error) {
      failures.push("calendar");
      console.error("[cron] calendar sync run failed", {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // Only aggregate counters are logged; payloads and endpoints never are.
  console.info("[cron] session jobs", {
    reminders,
    calendar,
    failures,
  });

  if (failures.length === 2) {
    return apiError(500, "internal_error", "The session job run failed.");
  }

  return apiSuccess({ reminders, calendar, failures });
}
