import {
  classApplicationIdSchema,
  classApplicationReviseSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import {
  reviseClassApplication,
  withdrawClassApplication,
} from "@/features/classes/class-application-service";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

async function parseId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = classApplicationIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new ApiError(400, "invalid_id", "Invalid application id.");
  }

  return parsed.data;
}

/** Corrects a pending or rejected application and puts it back in the queue. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const applicationId = await parseId(context);

    await enforceRateLimit({
      action: "classes:applications:revise",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const parsed = classApplicationReviseSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await reviseClassApplication(applicationId, parsed.data);

    return apiSuccess({ id: applicationId });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Withdraws a pending application. A decided application cannot be withdrawn. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const applicationId = await parseId(context);

    await enforceRateLimit({
      action: "classes:applications:withdraw",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    await withdrawClassApplication(applicationId);

    return apiSuccess({ id: applicationId });
  } catch (error) {
    return handleRouteError(error);
  }
}
