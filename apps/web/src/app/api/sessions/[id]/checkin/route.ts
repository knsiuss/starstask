import {
  sessionCheckInSchema,
  sessionIdSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { checkInSession } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Records the caller's attendance for an in-person session.
 *
 * The body only carries the reading from the browser. Every rule (window,
 * accuracy, radius, membership) is enforced by the database function, so a
 * forged request cannot talk its way past the checks.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    const { id } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    await enforceRateLimit({
      action: "sessions:checkin",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = sessionCheckInSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That location reading is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    const checkIn = await checkInSession(parsedId.data, parsed.data);

    return apiSuccess({ checkIn });
  } catch (error) {
    return handleRouteError(error);
  }
}
