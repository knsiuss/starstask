import {
  attendanceMeetingCorrectionSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { listCorrectionAudit } from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { recordAttendanceCorrection } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

/**
 * Manual attendance correction.
 *
 * The database function is the security boundary: it requires a class
 * organizer, validates membership and the reason, refuses a present-mark
 * without an explicit physical-verification attestation, and writes the
 * append-only audit row in the same transaction.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:corrections",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const parsed = attendanceMeetingCorrectionSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the correction details.",
        toFieldErrors(parsed.error),
      );
    }

    const checkinId = await recordAttendanceCorrection(id, parsed.data);

    return apiSuccess({ checkinId });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Append-only correction audit for this class. Managers only. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:meetings:corrections:list",
      identifier: session.user.id,
      limit: 300,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const entries = await listCorrectionAudit(found.id);

    return apiSuccess(entries);
  } catch (error) {
    return handleRouteError(error);
  }
}
