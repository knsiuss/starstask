import {
  sessionCreateSchema,
  sessionListQuerySchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, forbidden, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getClassRole } from "@/lib/db/classes";
import { listSessions } from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { createSession } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

/**
 * Session discovery.
 *
 * Visibility is enforced by `list_discussion_sessions`, so an anonymous caller
 * only ever receives public sessions and a signed-in caller only the classes
 * they belong to.
 */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const url = new URL(request.url);
    const parsed = sessionListQuerySchema.safeParse({
      class: url.searchParams.get("class") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      view: url.searchParams.get("view") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Those filters are not valid.",
      );
    }

    const session = await getSessionUser();

    await enforceRateLimit({
      action: "sessions:list",
      identifier: session?.user.id ?? getClientIdentifier(request),
      limit: 240,
      windowSeconds: 60,
    });

    const result = await listSessions(parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Creates a session for a class the caller administers. */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    await enforceRateLimit({
      action: "sessions:create",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const parsed = sessionCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    // The database function repeats this check; doing it here returns a clear
    // 403 instead of a generic database error.
    const role = await getClassRole(parsed.data.classId);

    if (!role.canManage) {
      throw forbidden();
    }

    const id = await createSession(parsed.data);

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
