import { classAdminGrantSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import {
  assignClassAdmin,
  InvalidGrantTargetError,
} from "@/lib/db/class-admins-service";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Grants class admin permissions. Gated by `manage_admins` on the class
 * (or platform admin). Never accepts a university id from the client — the
 * tenant key comes from the loaded class row.
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
      "manage_admins",
    );

    if (!found.universityId) {
      throw new ApiError(
        409,
        "class_unlinked",
        "This class is not linked to a university yet.",
      );
    }

    await enforceRateLimit({
      action: "classes:admins:grant",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = classAdminGrantSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the admin assignment.",
        toFieldErrors(parsed.error),
      );
    }

    const service = requireServiceRoleClient();

    try {
      const result = await assignClassAdmin(service, {
        classId: found.id,
        universityId: found.universityId,
        actorId: session.user.id,
        userId: parsed.data.userId,
        studentIdentityId: parsed.data.studentIdentityId,
        permissionCodes: parsed.data.permissionCodes,
      });

      return apiSuccess(result, 201);
    } catch (error) {
      if (error instanceof InvalidGrantTargetError) {
        throw new ApiError(422, "invalid_target", error.message);
      }

      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
