import {
  leaveOcrConfirmSchema,
  leaveRequestIdSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { confirmLeaveOcr } from "@/features/leave/leave-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Records that the student reviewed the extracted values.
 *
 * Confirmation is provenance, not approval: it marks which fields came from OCR
 * and which the student typed or corrected. It never advances the workflow.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;
    const parsedId = leaveRequestIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(
        404,
        "not_found",
        "That absence request was not found.",
      );
    }

    await enforceRateLimit({
      action: "leave-requests:ocr-confirm",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const body = (await request.json()) as unknown;
    const parsed = leaveOcrConfirmSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Those field sources are not valid.",
        toFieldErrors(parsed.error),
      );
    }

    await confirmLeaveOcr(parsedId.data, parsed.data.fieldSources);

    return apiSuccess({ id: parsedId.data, confirmed: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
