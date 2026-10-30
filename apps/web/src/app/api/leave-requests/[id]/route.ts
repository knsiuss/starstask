import {
  leaveRequestIdSchema,
  leaveRequestUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { updateLeaveRequest } from "@/features/leave/leave-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Saves a draft or a request returned for revision. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = leaveRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(
        404,
        "not_found",
        "That absence request was not found.",
      );
    }

    await enforceRateLimit({
      action: "leave-requests:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const body = (await request.json()) as unknown;
    const parsed = leaveRequestUpdateSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await updateLeaveRequest(parsedId.data, parsed.data);

    return apiSuccess({ id: parsedId.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
