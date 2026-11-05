import {
  attendanceRosterUpsertSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { recordRosterUpsert } from "@/lib/db/academic-attendance";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Bulk-records attendance for one meeting. Gated by `manage_attendance`.
 * Only identities actively enrolled in the meeting's offering are written;
 * everything else is reported in `skipped`.
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
      action: "classes:academic-attendance:records:record",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const parsed = attendanceRosterUpsertSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the attendance rows.",
        toFieldErrors(parsed.error),
      );
    }

    const service = requireServiceRoleClient();
    const result = await recordRosterUpsert(
      service,
      session.user.id,
      parsed.data.meetingId,
      found.id,
      parsed.data.entries,
    );

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
