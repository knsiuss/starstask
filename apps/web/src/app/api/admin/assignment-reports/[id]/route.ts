import {
  assignmentReportIdSchema,
  assignmentReportReviewSchema,
  toFieldErrors,
} from "@starstask/contracts";
import { after } from "next/server";

import {
  ApiError,
  forbidden,
  notFound,
  serviceUnavailable,
} from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  getAssignmentReportClassId,
  reviewAssignmentReport,
} from "@/lib/db/assignment-trust";
import { getClassRole } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { dispatchNotificationEvents } from "@/lib/push/dispatch";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Resolves or dismisses one assignment report.
 *
 * Any signed-in user may call it, but only the class manager of the reported
 * class passes the class-role check. The database function independently
 * checks `can_manage_class` and refuses to review a report twice.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = assignmentReportIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid report id.");
    }

    await enforceRateLimit({
      action: "assignment-reports:review",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const classId = await getAssignmentReportClassId(parsedId.data);

    if (!classId) {
      throw notFound();
    }

    const role = await getClassRole(classId);

    if (!role.canManage) {
      throw forbidden();
    }

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

    // The reporter should hear about the outcome now, not on the next cron pass.
    after(() => dispatchNotificationEvents());

    return apiSuccess({ id: parsedId.data, status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
