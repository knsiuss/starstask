import {
  sessionCheckInRecordSchema,
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
import { recordCheckIn } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Records attendance for a class member when no location reading is available.
 *
 * The user comes from the body here (unlike self check-in) because an organizer
 * is writing about somebody else. The database confirms the caller administers
 * the class and that the target belongs to it.
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
      action: "sessions:checkin-record",
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

    const parsed = sessionCheckInRecordSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That attendance entry is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    const checkInId = await recordCheckIn(parsedId.data, parsed.data);

    return apiSuccess({ checkInId, status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
