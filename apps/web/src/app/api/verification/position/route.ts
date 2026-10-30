import {
  declaredPositionUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { updateDeclaredPosition } from "@/features/verification/verification-service";

export const dynamic = "force-dynamic";

/**
 * Saves the student's own position claim.
 *
 * This endpoint writes a profile field. It grants no role, creates no
 * membership, and does not start a verification request.
 */
export async function PUT(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "verification:position",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const parsed = declaredPositionUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid position.",
        toFieldErrors(parsed.error),
      );
    }

    const position = await updateDeclaredPosition(parsed.data.position);

    return apiSuccess({ position });
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
