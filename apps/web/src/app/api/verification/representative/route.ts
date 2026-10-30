import { representativeGrantSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { becomeClassRepresentative } from "@/features/verification/verification-service";

export const dynamic = "force-dynamic";

/**
 * Direct class representative grant (temporary, while review is disabled).
 *
 * The caller must be a member of the class; the database re-checks membership,
 * class status, and the 5-representatives-per-class cap.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "verification:representative:grant",
      identifier: session.user.id,
      limit: 10,
      windowSeconds: 3600,
    });

    const parsed = representativeGrantSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await becomeClassRepresentative(parsed.data.classId);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
