import { verificationRequestIdSchema } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { submitVerification } from "@/features/verification/verification-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Sends a draft to the platform admin queue.
 *
 * Submitting does not grant anything. Approval is a separate, platform-admin
 * decision.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = verificationRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(404, "not_found", "That request was not found.");
    }

    await enforceRateLimit({
      action: "verification:requests:submit",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 60,
    });

    await submitVerification(parsedId.data);

    return apiSuccess({ submitted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
