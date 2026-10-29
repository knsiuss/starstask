import {
  assignmentIdSchema,
  assignmentReviewSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSubmissionDetail } from "@/lib/db/class-submissions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { reviewSubmission } from "@/features/classes/class-review-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

/**
 * Approves or rejects a submission.
 *
 * Approval makes the assignment public, so the reviewer must send
 * `confirmPublic: true`; the contract rejects an approval without it. The
 * database function then verifies class-admin permission, blocks self-review,
 * records the decision and audit entry, publishes atomically, and queues the
 * submitter notification.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    const parsedId = assignmentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid submission id.");
    }

    await enforceRateLimit({
      action: "classes:submissions:review",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const detail = await getSubmissionDetail(parsedId.data);

    if (!detail || detail.class_id !== found.id) {
      throw notFound();
    }

    const parsed = assignmentReviewSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await reviewSubmission(parsedId.data, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
