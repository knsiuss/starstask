import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import {
  AssignmentNotFoundError,
  LastAdminError,
  revokeClassAdmin,
} from "@/lib/db/class-admins-service";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Revokes a class admin assignment. Gated by `manage_admins`. The database
 * last-admin guard is mapped to 409; it is the final line of defense, not
 * the only one.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; assignmentId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    const { slug, assignmentId } = await context.params;
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

    if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) {
      throw new ApiError(404, "not_found", "Admin assignment not found.");
    }

    await enforceRateLimit({
      action: "classes:admins:revoke",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const service = requireServiceRoleClient();

    try {
      await revokeClassAdmin(service, {
        classId: found.id,
        universityId: found.universityId,
        actorId: session.user.id,
        assignmentId,
      });
    } catch (error) {
      if (error instanceof AssignmentNotFoundError) {
        throw new ApiError(404, "not_found", "Admin assignment not found.");
      }

      if (error instanceof LastAdminError) {
        throw new ApiError(409, "last_admin", error.message);
      }

      throw error;
    }

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
