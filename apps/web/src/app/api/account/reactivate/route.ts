import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

import { reactivateAccountSchema } from "@/features/account/account-schemas";
import { reactivateMyAccount } from "@/features/account/account-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 4 * 1024;

/**
 * Reactivates a soft-deactivated account. The caller can only bring back
 * their own session (no user id is accepted), and tombstoned accounts cannot
 * be reactivated (the RPC raises 22023 for that case).
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
      action: "account:reactivate",
      identifier: session.user.id,
      limit: 10,
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

    let body: unknown = {};
    const rawText = await request.text();

    if (rawText.trim().length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch {
        throw new ApiError(
          400,
          "invalid_json",
          "The request body could not be read.",
        );
      }
    }

    const parsed = reactivateAccountSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
      );
    }

    const result = await reactivateMyAccount(session);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
