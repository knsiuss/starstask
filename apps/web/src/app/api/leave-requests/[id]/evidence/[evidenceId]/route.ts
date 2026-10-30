import {
  leaveEvidenceIdSchema,
  leaveRequestIdSchema,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { removeEvidence } from "@/features/leave/evidence-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; evidenceId: string }> };

/**
 * Removes one evidence file.
 *
 * The row is soft-deleted first (keeping the audit trail) and the object is
 * deleted after. Ownership and the editable status are checked in SQL.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const { id, evidenceId } = await context.params;

    if (
      !leaveRequestIdSchema.safeParse(id).success ||
      !leaveEvidenceIdSchema.safeParse(evidenceId).success
    ) {
      throw new ApiError(404, "not_found", "That file was not found.");
    }

    await enforceRateLimit({
      action: "leave-requests:evidence-delete",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
    });

    await removeEvidence(evidenceId);

    return apiSuccess({ id: evidenceId, removed: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
