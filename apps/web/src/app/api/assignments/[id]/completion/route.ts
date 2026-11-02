import {
  assignmentIdSchema,
  assignmentCompletionSchema,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { setAssignmentCompletion } from "@/lib/db/assignment-completions";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Marks or clears the caller's own completion mark.
 *
 * This is personal tracking only: it never edits the assignment, never counts
 * as a submission, and is invisible to class admins and lecturers. The
 * database policy re-checks that the assignment is published and belongs to a
 * class the caller is an active member of.
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
      action: "assignments:completion",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const assignment = await getAssignmentDetail(parsedId.data);

    if (!assignment || assignment.status !== "published") {
      throw notFound();
    }

    const parsed = assignmentCompletionSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_body",
        "Send { completed: true } or { completed: false }.",
      );
    }

    await setAssignmentCompletion(
      session.user.id,
      parsedId.data,
      parsed.data.completed,
    );

    return apiSuccess({ completed: parsed.data.completed });
  } catch (error) {
    return handleRouteError(error);
  }
}
