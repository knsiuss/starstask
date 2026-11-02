import { notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getAttendanceMeetingDetail } from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Live detail used by the dashboard polling: meeting, roster, and failures. */
export async function GET(
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
      action: "attendance:meetings:detail",
      identifier: session.user.id,
      limit: 3_600,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const detail = await getAttendanceMeetingDetail(id, found.id);

    if (!detail) {
      throw notFound();
    }

    return apiSuccess(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
