import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { revokeCourseInviteToken } from "@/lib/db/course-invites";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Revokes a course invitation token. Platform-admin only while the invite
 * usage policy is unresolved; revocation never creates or redeems anything.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    const session = await requirePlatformAdmin();
    const { tokenId } = await context.params;

    if (!/^[0-9a-f-]{36}$/i.test(tokenId)) {
      throw new ApiError(404, "not_found", "Invite token not found.");
    }

    await enforceRateLimit({
      action: "admin:course-invites:revoke",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const service = requireServiceRoleClient();
    const outcome = await revokeCourseInviteToken(
      service,
      session.user.id,
      tokenId,
    );

    if (outcome === "not_found") {
      throw new ApiError(404, "not_found", "Invite token not found.");
    }

    if (outcome === "already_inactive") {
      throw new ApiError(
        409,
        "already_inactive",
        "The invite token is no longer active.",
      );
    }

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
