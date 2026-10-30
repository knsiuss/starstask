import {
  classScheduleIdSchema,
  classScheduleUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  deleteClassScheduleEntry,
  updateClassScheduleEntry,
} from "@/lib/db/class-schedule";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassMember } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; scheduleId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, scheduleId } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:schedule:update",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsedId = classScheduleIdSchema.safeParse(scheduleId);

    if (!parsedId.success) {
      throw notFound();
    }

    const parsed = classScheduleUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the schedule details.",
        toFieldErrors(parsed.error),
      );
    }

    await updateClassScheduleEntry(found.id, parsedId.data, parsed.data);

    return apiSuccess({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, scheduleId } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:schedule:delete",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsedId = classScheduleIdSchema.safeParse(scheduleId);

    if (!parsedId.success) {
      throw notFound();
    }

    await deleteClassScheduleEntry(found.id, parsedId.data);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
