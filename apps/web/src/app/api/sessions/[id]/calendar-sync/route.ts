import { sessionIdSchema } from "@starstask/contracts";

import {
  ApiError,
  forbidden,
  notFound,
  serviceUnavailable,
} from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google/config";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CalendarSyncError,
  syncSessionForUser,
  type CalendarSyncFailure,
} from "@/features/integrations/google-calendar-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const FAILURE_RESPONSES: Record<
  CalendarSyncFailure,
  { status: number; code: string; message: string }
> = {
  not_connected: {
    status: 409,
    code: "calendar_not_connected",
    message: "Connect Google Calendar before adding this session.",
  },
  revoked: {
    status: 409,
    code: "calendar_reconnect_required",
    message: "Google Calendar access was revoked. Reconnect to continue.",
  },
  transient: {
    status: 502,
    code: "calendar_unavailable",
    message: "Google Calendar is not responding. Try again shortly.",
  },
  invalid_request: {
    status: 502,
    code: "calendar_error",
    message: "Google Calendar rejected the event. Try again later.",
  },
  session_not_found: {
    status: 404,
    code: "not_found",
    message: "The requested session was not found.",
  },
};

/**
 * Creates or updates the caller's Google Calendar event for one session.
 *
 * The session is authorised with the caller's own session before the service
 * role is used, so a user can only ever sync a session they may view — and only
 * into their own calendar.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    if (!isGoogleCalendarConfigured()) {
      throw new ApiError(
        503,
        "calendar_not_configured",
        "Google Calendar integration is not configured on this deployment.",
      );
    }

    const { id } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    await enforceRateLimit({
      action: "sessions:calendar_sync",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const supabase = await createSupabaseServerClient();
    const { data: canView, error } = await supabase.rpc("can_view_session", {
      p_session_id: parsedId.data,
    });

    if (error) {
      throw new ApiError(500, "internal_error", "Could not check access.");
    }

    if (canView !== true) {
      throw forbidden();
    }

    const result = await syncSessionForUser(session.user.id, parsedId.data);

    if (result.status === "failed") {
      const mapped = FAILURE_RESPONSES[result.category];

      throw new ApiError(mapped.status, mapped.code, mapped.message);
    }

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof CalendarSyncError) {
      const mapped = FAILURE_RESPONSES[error.category];

      return handleRouteError(
        new ApiError(mapped.status, mapped.code, mapped.message),
      );
    }

    return handleRouteError(error);
  }
}
