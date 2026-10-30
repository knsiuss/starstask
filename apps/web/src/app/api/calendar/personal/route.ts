import {
  personalCalendarEventCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { createPersonalCalendarEvent } from "@/lib/db/calendar-events";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Creates an event that is visible only to the signed-in user. */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "calendar:personal:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = personalCalendarEventCreateSchema.safeParse(
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

    const id = await createPersonalCalendarEvent(session.user.id, parsed.data);

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
