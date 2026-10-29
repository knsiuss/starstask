import { myAssignmentsQuerySchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getMyAssignments } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "assignments:mine",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const url = new URL(request.url);
    const parsed = myAssignmentsQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_query",
        "One or more filters are invalid.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await getMyAssignments(session.user.id, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
