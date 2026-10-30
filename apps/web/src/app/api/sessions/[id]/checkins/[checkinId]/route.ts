import {
  sessionCheckInIdSchema,
  sessionCheckInReviewSchema,
  sessionIdSchema,
  toFieldErrors,
} from "@starstask/contracts";

import {
  ApiError,
  forbidden,
  notFound,
  serviceUnavailable,
} from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getClassRole } from "@/lib/db/classes";
import { getSessionById } from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { reviewCheckIn } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; checkinId: string }>;
};

/**
 * Overrides one attendance row.
 *
 * Organizers only, and the database verifies that the row belongs to the
 * session in the path before applying the change.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    const { id, checkinId } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);
    const parsedCheckInId = sessionCheckInIdSchema.safeParse(checkinId);

    if (!parsedId.success || !parsedCheckInId.success) {
      throw notFound();
    }

    await enforceRateLimit({
      action: "sessions:checkin-review",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const existing = await getSessionById(parsedId.data);

    if (!existing) {
      throw notFound();
    }

    const role = await getClassRole(existing.classId);

    if (!role.canManage) {
      throw forbidden();
    }

    const parsed = sessionCheckInReviewSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That attendance status is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    await reviewCheckIn(parsedId.data, parsedCheckInId.data, parsed.data);

    return apiSuccess({
      checkInId: parsedCheckInId.data,
      status: parsed.data.status,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
