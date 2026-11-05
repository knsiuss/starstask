import {
  attendanceCorrectionSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { correctRecord } from "@/lib/db/academic-attendance";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Corrects one attendance record. Gated by `manage_attendance`; the
 * correction ledger (`attendance_corrections`) is append-only and written
 * before the record is updated.
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
      action: "classes:academic-attendance:records:correct",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = attendanceCorrectionSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the correction.",
        toFieldErrors(parsed.error),
      );
    }

    const service = requireServiceRoleClient();
    const outcome = await correctRecord(
      service,
      session.user.id,
      found.id,
      parsed.data.recordId,
      parsed.data.newStatus,
      parsed.data.reason,
    );

    if (outcome === "not_found") {
      throw new ApiError(404, "not_found", "Attendance record not found.");
    }

    if (outcome === "unchanged") {
      throw new ApiError(
        409,
        "unchanged",
        "The record already has this status.",
      );
    }

    return apiSuccess({ corrected: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
