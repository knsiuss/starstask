import {
  developerIncidentCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireDeveloperApiAccess } from "@/lib/auth/developer";
import { createDeveloperIncident } from "@/lib/db/developer-operations";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Opens an operational incident. The actor is the server-verified session
 * user, never a client-supplied ID, so every stored incident is attributable
 * to an allowlisted developer.
 */
export async function POST(request: Request) {
  try {
    const session = await requireDeveloperApiAccess();

    await enforceRateLimit({
      action: "developer:incidents:create",
      identifier: getClientIdentifier(request),
      limit: 20,
      windowSeconds: 3600,
    });

    if (!isServiceRoleConfigured()) {
      throw serviceUnavailable();
    }

    const parsed = developerIncidentCreateSchema.safeParse(
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

    const incident = await createDeveloperIncident(session.user.id, parsed.data);

    return apiSuccess({ incident }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
