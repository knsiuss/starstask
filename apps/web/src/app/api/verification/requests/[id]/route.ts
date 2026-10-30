import {
  toFieldErrors,
  verificationRequestIdSchema,
  verificationRequestReviseSchema,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import {
  discardVerification,
  reviseVerification,
} from "@/features/verification/verification-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Updates the explanation of an editable request. */
export async function PATCH(request: Request, context: RouteContext) {
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
      action: "verification:requests:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const parsed = verificationRequestReviseSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await reviseVerification(parsedId.data, parsed.data);

    return apiSuccess({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Deletes an unfinished draft. A submitted request cannot be discarded. */
export async function DELETE(_request: Request, context: RouteContext) {
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
      action: "verification:requests:discard",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 60,
    });

    await discardVerification(parsedId.data);

    return apiSuccess({ discarded: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
