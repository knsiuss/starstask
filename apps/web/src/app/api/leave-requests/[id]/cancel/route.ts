import {
  leaveCancellationSchema,
  leaveRequestIdSchema,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { cancelLeaveRequest } from "@/features/leave/leave-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Cancels an absence request that has not been forwarded.
 *
 * The database decides who may cancel what: a student may cancel their own
 * draft or submitted request, a class admin may cancel a submitted one in their
 * class, and a forwarded request is terminal. The note is optional and is kept
 * for the audit trail rather than for any approval decision.
 */
export async function POST(request: Request, context: RouteContext) {
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
      action: "leave-requests:cancel",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 60,
    });

    const body = await readBody(request);
    const parsed = leaveCancellationSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "That cancellation note is not valid.",
      );
    }

    await cancelLeaveRequest(parsedId.data, parsed.data.note);

    return apiSuccess({ id: parsedId.data, status: "cancelled" });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Treats a missing or empty body as "no note" rather than a JSON error. */
async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "invalid_input", "Send a JSON object.");
  }
}
