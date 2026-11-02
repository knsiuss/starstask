import {
  attendanceMeetingCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { listClassAttendanceMeetings } from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createAttendanceMeeting } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Attendance meetings of the class with live counts. Managers only. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:list",
      identifier: session.user.id,
      limit: 3_600,
      windowSeconds: 3_600,
    });

    const meetings = await listClassAttendanceMeetings(found.id);

    return apiSuccess(meetings);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Creates one meeting for a subject in this class. */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:create",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3_600,
    });

    const parsed = attendanceMeetingCreateSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the meeting details.",
        toFieldErrors(parsed.error),
      );
    }

    if (parsed.data.classId !== found.id) {
      throw new ApiError(
        400,
        "invalid_input",
        "The meeting must belong to this class.",
        { classId: "Choose this class." },
      );
    }

    const id = await createAttendanceMeeting(found.id, parsed.data);

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
