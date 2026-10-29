import { savedAssignmentSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { addSavedAssignment, listSavedAssignments } from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const session = await requireSession();
    const saved = await listSavedAssignments(session.user.id);

    return apiSuccess({ saved });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    await enforceRateLimit({
      action: "saved:add",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ApiError(
        400,
        "invalid_json",
        "The request body could not be read.",
      );
    }

    const parsed = savedAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    await addSavedAssignment(session.user.id, parsed.data.assignmentId);

    return apiSuccess({ assignmentId: parsed.data.assignmentId }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function requireSession() {
  if (!isSupabaseConfigured()) {
    throw serviceUnavailable();
  }

  const session = await getSessionUser();

  if (!session) {
    throw unauthorized();
  }

  return session;
}
