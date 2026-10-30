import {
  sessionIdSchema,
  sessionUpdateSchema,
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
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { updateSession } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Session detail. RLS decides whether the caller may read the row at all. */
export async function GET(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { id } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    const session = await getSessionUser();

    await enforceRateLimit({
      action: "sessions:detail",
      identifier: session?.user.id ?? getClientIdentifier(request),
      limit: 240,
      windowSeconds: 60,
    });

    const found = await getSessionById(parsedId.data);

    if (!found) {
      throw notFound();
    }

    return apiSuccess({ session: found });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Edits a scheduled session. Class managers only, re-checked in SQL. */
export async function PATCH(request: Request, context: RouteContext) {
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
      action: "sessions:update",
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

    const parsed = sessionUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await updateSession(parsedId.data, parsed.data);

    return apiSuccess({ id: parsedId.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
