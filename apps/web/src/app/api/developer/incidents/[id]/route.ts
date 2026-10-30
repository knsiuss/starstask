import { z } from "zod";

import {
  developerIncidentStatusSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireDeveloperApiAccess } from "@/lib/auth/developer";
import { DataAccessError } from "@/lib/db/assignments";
import { updateDeveloperIncidentStatus } from "@/lib/db/developer-operations";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const incidentIdSchema = z.uuid();

type RouteContext = { params: Promise<{ id: string }> };

/**
 * A missing incident surfaces as a specific data-access failure; everything
 * else is an unexpected error that handleRouteError must sanitize.
 */
function throwNotFoundIfMissing(error: unknown): void {
  if (
    error instanceof DataAccessError &&
    (error.code === "not_found" || error.code === "PGRST116")
  ) {
    throw new ApiError(404, "not_found", "That incident was not found.");
  }
}

/**
 * Changes an incident's status. Like every developer mutation, the actor
 * comes from the verified session and the route re-runs the allowlist guard
 * independently of the page.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireDeveloperApiAccess();

    await enforceRateLimit({
      action: "developer:incidents:status",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 3600,
    });

    if (!isServiceRoleConfigured()) {
      throw serviceUnavailable();
    }

    const { id } = await context.params;
    const parsedId = incidentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(404, "not_found", "That incident was not found.");
    }

    const parsed = developerIncidentStatusSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    try {
      await updateDeveloperIncidentStatus(
        session.user.id,
        parsedId.data,
        parsed.data.status,
      );
    } catch (error) {
      throwNotFoundIfMissing(error);
      throw error;
    }

    return apiSuccess({ status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
