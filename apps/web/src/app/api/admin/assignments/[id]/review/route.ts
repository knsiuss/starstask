import {
  assignmentIdSchema,
  publicAssignmentReviewSchema,
  toFieldErrors,
} from "@starstask/contracts";
import { after } from "next/server";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { dispatchNotificationEvents } from "@/lib/push/dispatch";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { reviewPublicAssignment } from "@/features/admin/public-assignment-review-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Approves or rejects a class-less assignment request.
 *
 * Approval publishes the row, so the reviewer must send `confirmPublic: true`;
 * the contract rejects an approval without it. The database function re-checks
 * the platform-admin role, the pending state, and the class-less scope, then
 * records history, audit, and the submitter notification in one transaction.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const parsedId = assignmentIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid assignment id.");
    }

    await enforceRateLimit({
      action: "admin:assignments:review",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const parsed = publicAssignmentReviewSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await reviewPublicAssignment(parsedId.data, parsed.data);

    // The submitter should hear about a decision now, not on the next cron pass.
    after(() => dispatchNotificationEvents());

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
