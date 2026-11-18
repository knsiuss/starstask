import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

import { deactivateAccountSchema } from "@/features/account/account-schemas";
import { deactivateMyAccount } from "@/features/account/account-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 4 * 1024;

/**
 * Soft-deactivates the signed-in user's account. Reversible: signing back in
 * (or POSTing /api/account/reactivate) restores full access with all data
 * intact. The session must come from the verified cookie or bearer token; the
 * client never supplies a user id.
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
      action: "account:deactivate",
      identifier: session.user.id,
      limit: 5,
      windowSeconds: 3600,
      onBackendFailure: "closed",
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

    const parsed = deactivateAccountSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
      );
    }

    const result = await deactivateMyAccount(session, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
