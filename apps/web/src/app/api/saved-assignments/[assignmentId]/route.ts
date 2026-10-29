import { z } from "zod";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { removeSavedAssignment } from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const assignmentIdSchema = z.uuid("Invalid assignment id");

type RouteContext = { params: Promise<{ assignmentId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "saved:remove",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = assignmentIdSchema.safeParse(
      (await context.params).assignmentId,
    );

    if (!parsed.success) {
      throw new ApiError(400, "invalid_id", "The assignment id is invalid.");
    }

    await removeSavedAssignment(session.user.id, parsed.data);

    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
