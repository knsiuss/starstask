import {
  calendarEventIdSchema,
  personalCalendarEventUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  deletePersonalCalendarEvent,
  updatePersonalCalendarEvent,
} from "@/lib/db/calendar-events";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "calendar:personal:update",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsedId = calendarEventIdSchema.safeParse((await context.params).id);

    if (!parsedId.success) {
      throw notFound();
    }

    const parsed = personalCalendarEventUpdateSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the event details.",
        toFieldErrors(parsed.error),
      );
    }

    const updated = await updatePersonalCalendarEvent(
      session.user.id,
      parsedId.data,
      parsed.data,
    );

    if (!updated) {
      throw notFound();
    }

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

    const session = await requireSession();

    await enforceRateLimit({
      action: "calendar:personal:delete",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsedId = calendarEventIdSchema.safeParse((await context.params).id);

    if (!parsedId.success) {
      throw notFound();
    }

    const deleted = await deletePersonalCalendarEvent(
      session.user.id,
      parsedId.data,
    );

    if (!deleted) {
      throw notFound();
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
