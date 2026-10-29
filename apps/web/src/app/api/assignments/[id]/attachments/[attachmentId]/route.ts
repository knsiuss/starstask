import {
  assignmentIdSchema,
  attachmentIdSchema,
  attachmentRemovalSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { removeSensitiveAttachment } from "@/features/classes/class-review-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

/**
 * Removes a published attachment that should not be public.
 *
 * The row is deleted first (so the file stops being reachable through signed
 * URLs), then the storage object is deleted with the service role. A reason is
 * required and recorded in the audit trail.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id, attachmentId } = await context.params;

    const parsedAssignment = assignmentIdSchema.safeParse(id);
    const parsedAttachment = attachmentIdSchema.safeParse(attachmentId);

    if (!parsedAssignment.success || !parsedAttachment.success) {
      throw new ApiError(400, "invalid_id", "Invalid attachment reference.");
    }

    await enforceRateLimit({
      action: "assignments:attachments:remove",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = attachmentRemovalSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "A removal reason is required.",
        toFieldErrors(parsed.error),
      );
    }

    await removeSensitiveAttachment(parsedAttachment.data, parsed.data.reason);

    return apiSuccess({ id: parsedAttachment.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
