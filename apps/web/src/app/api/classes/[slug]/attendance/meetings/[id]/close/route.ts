import {
  attendanceMeetingCloseSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { closeAttendanceMeeting } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/**
 * Closes a meeting. `finalize: true` also writes an explicit absence for every
 * eligible member without a record. An unopened meeting cannot be closed.
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
      action: "attendance:meetings:close",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const parsed = attendanceMeetingCloseSchema.safeParse(
      await readOptionalJson(request),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the close request.",
        toFieldErrors(parsed.error),
      );
    }

    const absencesCreated = await closeAttendanceMeeting(
      id,
      parsed.data.finalize,
    );

    return apiSuccess({ finalized: parsed.data.finalize, absencesCreated });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();

  if (text.trim() === "") {
    return {};
  }

  return JSON.parse(text) as unknown;
}
