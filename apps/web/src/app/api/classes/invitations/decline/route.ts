import {
  classInvitationDeclineSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import { declineClassInvitation } from "@/features/classes/class-invitation-service";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:invitations:decline",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const parsed = classInvitationDeclineSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Invalid invitation id.",
        toFieldErrors(parsed.error),
      );
    }

    await declineClassInvitation(parsed.data.invitationId);

    return apiSuccess({ declined: true, invitationId: parsed.data.invitationId });
  } catch (error) {
    return handleRouteError(error);
  }
}
