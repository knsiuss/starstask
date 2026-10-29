import { invitationIdSchema } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { revokeClassInvitation } from "@/features/classes/class-invitation-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

/** Revokes an invitation link. The token can never be used again. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    const parsedId = invitationIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new ApiError(400, "invalid_id", "Invalid invitation id.");
    }

    await enforceRateLimit({
      action: "classes:invitations:revoke",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    // `revoke_class_invitation` verifies the invitation belongs to a class the
    // caller may manage, so the slug never becomes an authorization bypass.
    await revokeClassInvitation(parsedId.data);

    return apiSuccess({ id: parsedId.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
