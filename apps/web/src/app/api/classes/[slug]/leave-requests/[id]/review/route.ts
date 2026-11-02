import {
  leaveRequestIdSchema,
  leaveRequestReviewSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { getLeaveRequestById } from "@/lib/db/leave";
import { reviewLeaveRequest } from "@/features/leave/leave-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

/**
 * Records a class admin's decision on one submitted request.
 *
 * The class comes from the URL, so the caller cannot point the decision at a
 * class they do not manage. The database re-checks the manager role, the
 * request status, and that the reviewer is not the student, and it applies the
 * attendance consequence inside the same transaction.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const parsedId = leaveRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "leave-requests:review",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const body = await readBody(request);
    const parsed = leaveRequestReviewSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose approve or reject, and keep the note under 2000 characters.",
        toFieldErrors(parsed.error),
      );
    }

    const leaveRequest = await getLeaveRequestById(parsedId.data);

    // Another class's request is indistinguishable from one that does not
    // exist, so an admin cannot probe other classes through this route.
    if (!leaveRequest || leaveRequest.classId !== found.id) {
      throw notFound();
    }

    await reviewLeaveRequest(parsedId.data, parsed.data);

    return apiSuccess({
      id: parsedId.data,
      status: parsed.data.decision,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new ApiError(400, "invalid_input", "Send a JSON object.");
  }
}
