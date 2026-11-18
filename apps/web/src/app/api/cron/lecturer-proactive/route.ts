import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  isoWeekKeyForDate,
  readProactiveSummary,
} from "@/lib/push/lecturer-proactive";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

// Enqueues proactive lecturer alerts by calling a service-role RPC; delivery is
// owned by the existing notification-events cron (this route does not push).
// `getPushConfig`/senders are deliberately not imported here: the RPC only
// writes `notification_events`, and `claim_notification_events` decides which
// rows get delivered when the `notification-events` cron next runs.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The RPC is not yet present in the hand-maintained `Database` type (the
// migration is unapplied); mirror the account-lane pattern and narrow the
// client locally.
type ProactiveRpcResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

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
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<ProactiveRpcResult>;
    const { data, error } = await rpc("enqueue_lecturer_proactive_alerts", {
      p_now: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    const summary = readProactiveSummary(data);

    if (!summary) {
      throw new Error("Unexpected RPC payload shape");
    }

    const result = {
      isoWeek: isoWeekKeyForDate(new Date()),
      atRiskSubjects: summary.atRiskSubjects,
      behindPaceOfferings: summary.behindPaceOfferings,
    };

    // Only aggregate counters are logged; no class, subject, or user data.
    console.info("[cron] lecturer proactive alerts", result);

    return apiSuccess(result);
  } catch (error) {
    console.error("[cron] lecturer proactive alerts failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "unknown",
    });

    return apiError(500, "internal_error", "The proactive alert run failed.");
  }
}
