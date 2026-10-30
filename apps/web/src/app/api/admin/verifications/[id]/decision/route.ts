import {
  toFieldErrors,
  verificationDecisionSchema,
  verificationRequestIdSchema,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { decideVerification } from "@/features/verification/verification-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Approves, rejects, or requests revision on a verification request.
 *
 * Platform-admin identity comes from the verified session. An approval also
 * creates the class admin assignment for the request's class, inside the same
 * database transaction as the status change.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const parsedId = verificationRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(404, "not_found", "That request was not found.");
    }

    await enforceRateLimit({
      action: "admin:verifications:decide",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = verificationDecisionSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const status = await decideVerification(parsedId.data, parsed.data);

    return apiSuccess({ status });
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
