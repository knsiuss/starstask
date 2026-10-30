import { invitationIdSchema, toFieldErrors } from "@starstask/contracts";
import { z } from "zod";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import { acceptPendingInvitation } from "@/features/classes/class-invitation-service";
import { getClassById } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const acceptPendingSchema = z
  .object({
    invitationId: invitationIdSchema,
  })
  .strict();

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:invitations:accept-pending",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 3600,
    });

    const parsed = acceptPendingSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Invalid invitation id.",
        toFieldErrors(parsed.error),
      );
    }

    const { classId } = await acceptPendingInvitation(
      parsed.data.invitationId,
    );
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
