import {
  attendanceMeetingLocationChangeSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { changeAttendanceMeetingLocation } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/**
 * Explicit, audited location change. Required because the meeting location is
 * otherwise locked while attendance is open.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:location",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const parsed = attendanceMeetingLocationChangeSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the location details.",
        toFieldErrors(parsed.error),
      );
    }

    await changeAttendanceMeetingLocation(id, parsed.data);

    return apiSuccess({ changed: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
