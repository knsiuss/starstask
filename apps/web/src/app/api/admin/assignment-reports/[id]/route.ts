import {
  assignmentReportIdSchema,
  assignmentReportReviewSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { reviewAssignmentReport } from "@/lib/db/assignment-trust";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requirePlatformAdmin } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Resolves or dismisses one assignment report.
 *
 * The route is platform-admin only; the database function independently checks
 * `can_manage_class` and refuses to review a report twice.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const parsedId = assignmentReportIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid report id.");
    }

    await enforceRateLimit({
      action: "admin:assignment-reports:review",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const parsed = assignmentReportReviewSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await reviewAssignmentReport(parsedId.data, parsed.data);

    return apiSuccess({ id: parsedId.data, status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
