import {
  assignmentIdSchema,
  assignmentReportCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { createAssignmentReport } from "@/lib/db/assignment-trust";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Reports a problem with a published assignment.
 *
 * The report is advisory: it never edits the assignment. A reviewer decides in
 * the platform console, and the database function records who closed it.
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
      action: "assignments:report",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const assignment = await getAssignmentDetail(parsedId.data);

    if (!assignment || assignment.status !== "published") {
      throw notFound();
    }

    const parsed = assignmentReportCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const reportId = await createAssignmentReport(parsedId.data, parsed.data);

    return apiSuccess({ id: reportId }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
