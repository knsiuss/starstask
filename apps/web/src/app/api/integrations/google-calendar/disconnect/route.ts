import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { disconnectCalendar } from "@/features/integrations/google-calendar-service";

export const dynamic = "force-dynamic";

/**
 * Disconnects Google Calendar.
 *
 * The stored tokens are deleted and the Google grant is revoked on a best-effort
 * basis. Calendar event mappings are removed with the connection, so no orphaned
 * mapping can point at an event StarsTask can no longer manage.
 */
export async function POST() {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    await enforceRateLimit({
      action: "calendar:disconnect",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    await disconnectCalendar(session.user.id);

    return apiSuccess({ connected: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
