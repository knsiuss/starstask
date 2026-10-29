import {
  assignmentIdSchema,
  assignmentModerationSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { moderateAssignment } from "@/features/classes/class-review-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Unpublishes, archives, or restores a published assignment.
 *
 * A class admin may moderate their own class; a platform admin may moderate
 * anything. The database function is the authority for that distinction, so a
 * forged request cannot moderate an unrelated class.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = assignmentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid assignment id.");
    }

    await enforceRateLimit({
      action: "assignments:moderate",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const assignment = await getAssignmentDetail(parsedId.data);

    if (!assignment) {
      throw notFound();
    }

    const parsed = assignmentModerationSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await moderateAssignment(parsedId.data, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
