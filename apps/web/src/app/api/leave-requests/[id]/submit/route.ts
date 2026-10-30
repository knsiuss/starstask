import { leaveRequestIdSchema } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { submitLeaveRequest } from "@/features/leave/leave-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Submits a draft request.
 *
 * The database re-checks completeness, ownership, and the presence of evidence,
 * so a client cannot submit a half-filled request by skipping the form.
 */
export async function POST(_request: Request, context: RouteContext) {
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
      action: "leave-requests:submit",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 60,
    });

    await submitLeaveRequest(parsedId.data);

    return apiSuccess({ id: parsedId.data, status: "submitted" });
  } catch (error) {
    return handleRouteError(error);
  }
}
