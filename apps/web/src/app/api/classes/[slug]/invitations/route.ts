import {
  classInvitationCreateSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassManager } from "@/features/classes/class-access";
import { createClassInvitation } from "@/features/classes/class-invitation-service";
import { listClassInvitations } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Invitation metadata for one class. The token hash is never selected. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:invitations:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    return apiSuccess(await listClassInvitations(found.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Creates an invitation link.
 *
 * The raw token is returned exactly once, in a `no-store` response. Only its
 * SHA-256 digest is persisted, so a database leak cannot reveal usable links.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:invitations:create",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const parsed = classInvitationCreateSchema.safeParse(
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

    const invitation = await createClassInvitation(found.id, parsed.data);

    return apiSuccess(
      {
        ...invitation,
        invitePath: `/invite/${invitation.token}`,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
