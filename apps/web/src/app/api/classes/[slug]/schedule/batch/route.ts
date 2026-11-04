import {
  classScheduleBatchCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { createClassScheduleEntries } from "@/lib/db/class-schedule";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isFeatureEnabled } from "@/lib/config/features";
import { requireClassMember } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/**
 * Persists the confirmed rows of one PDF import as a single insert, so a
 * bad row rejects the whole batch instead of leaving half a timetable.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    if (!isFeatureEnabled("ocr")) {
      throw new ApiError(
        403,
        "ocr_disabled",
        "Schedule import is not enabled on this deployment.",
      );
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassMember(slug);

    await enforceRateLimit({
      action: "classes:schedule:batch",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const parsed = classScheduleBatchCreateSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the imported schedule rows.",
        toFieldErrors(parsed.error),
      );
    }

    const entries = await createClassScheduleEntries(
      found.id,
      session.user.id,
      parsed.data,
    );

    return apiSuccess(entries, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
