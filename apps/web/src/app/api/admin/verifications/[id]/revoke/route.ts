import {
  toFieldErrors,
  verificationRequestIdSchema,
  verificationRevokeSchema,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { revokeVerificationAccess } from "@/features/verification/verification-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Removes the class admin access granted by an approved verification.
 *
 * The verification history is kept. Only the assignment for the verified class
 * is deleted, and the database refuses to remove the last admin of a class.
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
      action: "admin:verifications:revoke",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = verificationRevokeSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await revokeVerificationAccess(parsedId.data, parsed.data);

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
