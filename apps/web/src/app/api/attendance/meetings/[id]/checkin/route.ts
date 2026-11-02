import {
  attendanceMeetingCheckInSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { checkInAttendanceMeeting } from "@/features/attendance-meetings/meeting-service";

export const dynamic = "force-dynamic";

/**
 * Records the caller's check-in. Identity, membership, join date, window,
 * accuracy, and radius are all decided by the database function.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id } = await context.params;

    await enforceRateLimit({
      action: "attendance:meetings:checkin",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3_600,
    });

    const parsed = attendanceMeetingCheckInSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check your name, NIM, and location.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await checkInAttendanceMeeting(id, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
