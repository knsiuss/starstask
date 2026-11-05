import {
  normalizedAttendanceMeetingCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import {
  createMeeting,
  getOfferingForClass,
} from "@/lib/db/academic-attendance";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Creates a normalized attendance meeting for one of the class's offerings.
 * Gated by `manage_attendance`. The offering must belong to the class.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassPermission(
      slug,
      "manage_attendance",
    );

    if (!found.universityId) {
      throw new ApiError(
        409,
        "class_unlinked",
        "This class is not linked to a university yet.",
      );
    }

    await enforceRateLimit({
      action: "classes:academic-attendance:meetings:create",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = normalizedAttendanceMeetingCreateSchema.safeParse(
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

    const service = requireServiceRoleClient();
    const offering = await getOfferingForClass(
      service,
      parsed.data.offeringId,
      found.id,
    );

    if (!offering) {
      throw new ApiError(
        422,
        "invalid_offering",
        "The offering does not belong to this class.",
      );
    }

    const result = await createMeeting(
      service,
      session.user.id,
      offering,
      parsed.data,
    );

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
