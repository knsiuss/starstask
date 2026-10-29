import {
  classInvitationAcceptSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import { acceptClassInvitation } from "@/features/classes/class-invitation-service";
import { getClassById } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Redeems an invitation link for the signed-in user.
 *
 * The raw token is sent once, compared against its stored hash, and never
 * echoed back. Acceptance grants membership only, never an admin role.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:invitations:accept",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const parsed = classInvitationAcceptSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "This invitation link is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    const { classId } = await acceptClassInvitation(parsed.data.token);
    const joinedClass = await getClassById(classId);

    return apiSuccess({
      classId,
      slug: joinedClass?.slug ?? null,
      name: joinedClass?.name ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
