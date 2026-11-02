import {
  feedbackIdSchema,
  feedbackStatusUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { updateFeedbackStatus } from "@/lib/db/feedback";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Moves a feedback entry through the triage statuses. Platform admins only. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const parsedId = feedbackIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(
        404,
        "not_found",
        "That feedback entry was not found.",
      );
    }

    await enforceRateLimit({
      action: "admin:feedback:status",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = feedbackStatusUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That status is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    const updated = await updateFeedbackStatus(
      parsedId.data,
      parsed.data.status,
    );

    if (!updated) {
      throw new ApiError(
        404,
        "not_found",
        "That feedback entry was not found.",
      );
    }

    return apiSuccess({ id: parsedId.data, status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
