import { academicYearCreateSchema, toFieldErrors } from "@starstask/contracts";
import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { recordServiceRoleAudit } from "@/lib/db/audit";
import { isSupabaseConfigured } from "@/lib/env/public";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const createBodySchema = academicYearCreateSchema.and(
  z.object({ universityId: z.uuid() }),
);

/**
 * Creates an academic year for a university. Platform-admin only: no
 * university-admin delegation exists yet (decision register #4), and ordinary
 * users can never activate or restructure academic periods.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    const session = await requirePlatformAdmin();

    await enforceRateLimit({
      action: "admin:academic-years:create",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const parsed = createBodySchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the academic year details.",
        toFieldErrors(parsed.error),
      );
    }

    const service = requireServiceRoleClient();
    const { universityId, isCurrent, ...year } = parsed.data;

    // Clear any existing current year first: the partial unique index
    // academic_years_one_current would otherwise reject the insert.
    if (isCurrent) {
      const { error: clearError } = await service
        .from("academic_years")
        .update({ is_current: false })
        .eq("university_id", universityId)
        .eq("is_current", true);

      if (clearError) {
        throw new ApiError(
          500,
          "internal_error",
          "Could not update the current academic year.",
        );
      }
    }

    const { data, error } = await service
      .from("academic_years")
      .insert({
        university_id: universityId,
        code: year.code,
        name: year.name,
        start_date: year.startDate,
        end_date: year.endDate,
        status: year.status,
        is_current: isCurrent,
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23503") {
        throw new ApiError(
          422,
          "invalid_university",
          "The university does not exist.",
        );
      }

      if (error.code === "23505") {
        throw new ApiError(
          409,
          "duplicate_code",
          "An academic year with this code already exists for the university.",
        );
      }

      throw new ApiError(
        500,
        "internal_error",
        "Could not create the academic year.",
      );
    }

    const yearId = data.id as string;

    await recordServiceRoleAudit(service, {
      actorId: session.user.id,
      action: "academic_year_created",
      entityType: "academic_year",
      entityId: yearId,
      classId: null,
      universityId,
      metadata: { code: year.code, status: year.status, is_current: isCurrent },
    });

    return apiSuccess({ id: yearId });
  } catch (error) {
    return handleRouteError(error);
  }
}
