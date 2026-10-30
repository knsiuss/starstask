import { classInvitationAcceptSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getInvitationPreview } from "@/features/classes/class-invitation-service";
import { isSupabaseConfigured } from "@/lib/env/public";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

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
