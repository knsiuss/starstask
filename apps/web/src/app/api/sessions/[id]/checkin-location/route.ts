import {
  sessionCheckInLocationSchema,
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
import {
  clearCheckInLocation,
  setCheckInLocation,
} from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Saves the point an in-person session accepts check-ins from.
 *
 * The organizer is expected to stand in the room and press "use my location",
 * so the point comes from the same browser API the participants use. The
 * database still re-checks the permission and the session type.
 */
export async function PUT(request: Request, context: RouteContext) {
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
      action: "sessions:checkin-location",
      identifier: session.user.id,
      limit: 60,
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

    const parsed = sessionCheckInLocationSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That check-in location is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    await setCheckInLocation(parsedId.data, parsed.data);

    return apiSuccess({ id: parsedId.data, radiusM: parsed.data.radiusM });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Turns check-in off for the session without touching the schedule. */
export async function DELETE(_request: Request, context: RouteContext) {
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
      action: "sessions:checkin-location",
      identifier: session.user.id,
      limit: 60,
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

    await clearCheckInLocation(parsedId.data);

    return apiSuccess({ id: parsedId.data, cleared: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
