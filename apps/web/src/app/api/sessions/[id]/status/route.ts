import {
  sessionIdSchema,
  sessionStatusUpdateSchema,
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
import { setSessionStatus } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Cancels, completes, or reopens a session. */
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
      action: "sessions:status",
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

    const parsed = sessionStatusUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That status change is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    await setSessionStatus(parsedId.data, parsed.data);

    return apiSuccess({ id: parsedId.data, status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
