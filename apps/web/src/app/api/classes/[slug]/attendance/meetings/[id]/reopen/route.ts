import { serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { reopenAttendanceMeeting } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Reopens a closed or finalized meeting, removing only system absences. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:reopen",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const removedAbsences = await reopenAttendanceMeeting(id);

    return apiSuccess({ reopened: true, removedAbsences });
  } catch (error) {
    return handleRouteError(error);
  }
}
