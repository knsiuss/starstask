import {
  classCalendarEventCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { createClassCalendarEvent } from "@/lib/db/calendar-events";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/** Official events are written only by the class's own admins. */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:calendar:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = classCalendarEventCreateSchema.safeParse(
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

    const id = await createClassCalendarEvent(
      found.id,
      session.user.id,
      parsed.data,
    );

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
