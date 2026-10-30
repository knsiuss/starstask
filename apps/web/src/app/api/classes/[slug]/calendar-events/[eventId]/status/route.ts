import {
  calendarEventIdSchema,
  calendarEventStatusSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { setClassCalendarEventStatus } from "@/lib/db/calendar-events";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; eventId: string }> };

/** Cancelling or reopening an official event reaches the group immediately. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, eventId } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:calendar:status",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsedId = calendarEventIdSchema.safeParse(eventId);

    if (!parsedId.success) {
      throw notFound();
    }

    const parsed = calendarEventStatusSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid status.",
        toFieldErrors(parsed.error),
      );
    }

    const updated = await setClassCalendarEventStatus(
      found.id,
      parsedId.data,
      parsed.data.status,
    );

    if (!updated) {
      throw notFound();
    }

    return apiSuccess({ status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
