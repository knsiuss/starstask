import {
  classApplicationDecisionSchema,
  classApplicationIdSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getApplicationById, findClassDuplicates } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { decideClassApplication } from "@/features/classes/class-application-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Approves or rejects a class application.
 *
 * Platform-admin identity comes from the verified session; the applicant can
 * never decide their own application. Approval may optionally grant the
 * applicant the class admin role, and only a platform admin can ask for that.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const parsedId = classApplicationIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid application id.");
    }

    await enforceRateLimit({
      action: "admin:class-applications:decide",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = classApplicationDecisionSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    // Approval must stay an explicit choice: if a class with the same code or
    // name already exists in this academic period, the reviewer has to confirm
    // that another class is intended. Nothing is merged automatically.
    if (parsed.data.decision === "approved") {
      const application = await getApplicationById(parsedId.data);

      if (!application) {
        throw new ApiError(404, "not_found", "Application not found.");
      }

      const duplicates = await findClassDuplicates({
        name: application.proposed_name,
        classCode: application.proposed_class_code ?? undefined,
        academicYear: application.academic_year,
        semester: application.semester,
        institution: application.institution ?? undefined,
      });

      if (duplicates.length > 0 && !parsed.data.confirmDuplicate) {
        throw new ApiError(
          409,
          "possible_duplicate",
          "A class with this code or name already exists in this academic period. Review it, then confirm that a new class is still intended.",
          {
            confirmDuplicate:
              "Confirm that you reviewed the existing class and still want to create another one",
          },
        );
      }
    }

    const result = await decideClassApplication(parsedId.data, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
