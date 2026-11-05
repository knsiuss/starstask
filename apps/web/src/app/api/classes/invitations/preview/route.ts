import {
  classInvitationAcceptSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getInvitationPreview } from "@/features/classes/class-invitation-service";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    // Unauthenticated token oracle: the only abuse control is this limit,
    // keyed on the client IP (and closed-mode — no identifier, no preview).
    await enforceRateLimit({
      action: "classes:invitations:preview",
      identifier: getClientIdentifier(request),
      limit: 30,
      windowSeconds: 600,
      onBackendFailure: "closed",
    });

    const parsed = classInvitationAcceptSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Invalid invitation token.",
        toFieldErrors(parsed.error),
      );
    }

    const preview = await getInvitationPreview(parsed.data.token);

    return apiSuccess(preview);
  } catch (error) {
    return handleRouteError(error);
  }
}
