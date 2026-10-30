import {
  calendarEventIdSchema,
  classCalendarEventUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  archiveClassCalendarEvent,
  updateClassCalendarEvent,
} from "@/lib/db/calendar-events";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; eventId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, eventId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:calendar:update",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsedId = calendarEventIdSchema.safeParse(eventId);

    if (!parsedId.success) {
      throw notFound();
    }

    const parsed = classCalendarEventUpdateSchema.safeParse(
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

    const updated = await updateClassCalendarEvent(
      found.id,
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

/** Deleting an official event archives it, preserving the group's history. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, eventId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:calendar:archive",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsedId = calendarEventIdSchema.safeParse(eventId);

    if (!parsedId.success) {
      throw notFound();
    }

    const archived = await archiveClassCalendarEvent(found.id, parsedId.data);

    if (!archived) {
      throw notFound();
    }

    return apiSuccess({ archived: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
