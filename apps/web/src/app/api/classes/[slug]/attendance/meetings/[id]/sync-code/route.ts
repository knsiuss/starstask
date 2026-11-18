import { sessionIdSchema } from "@starstask/contracts";

import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { requireClassManager } from "@/features/classes/class-access";
import { notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { signAttendanceSyncToken } from "@/lib/attendance-sync/token";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Generates a 15-minute HMAC sync code for the SIAKAD browser extension. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:sync-code",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(parsedId.data, found.id);

    const { code, expiresAt } = signAttendanceSyncToken({
      meetingId: parsedId.data,
      classId: found.id,
      issuedBy: session.user.id,
    });

    return apiSuccess({ code, expiresAt });
  } catch (error) {
    return handleRouteError(error);
  }
}
