import {
  markNotificationsReadSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { markNotificationsRead } from "@/lib/db/notifications";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 8 * 1024;

/**
 * Marks the caller's inbox rows read. The owner is always the verified
 * session; the body only decides which of that user's rows are updated.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "notifications:read",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const declaredLength = Number(request.headers.get("content-length") ?? "0");

    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
      throw new ApiError(
        413,
        "payload_too_large",
        "The request body is too large.",
      );
    }

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

    const parsed = markNotificationsReadSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the selected notifications.",
        toFieldErrors(parsed.error),
      );
    }

    const updated = await markNotificationsRead(parsed.data);

    return apiSuccess({ updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
