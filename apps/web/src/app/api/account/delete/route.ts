import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

import { deleteAccountSchema } from "@/features/account/account-schemas";
import { tombstoneMyAccount } from "@/features/account/account-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 4 * 1024;

/**
 * Irreversible tombstone. `auth.users` is banned so the same identity cannot
 * sign back in, PII (bio, avatar) is cleared by the RPC, and name / NIM /
 * academic history remain. The client is expected to POST /api/auth/signout
 * after this succeeds; the response payload names that endpoint explicitly.
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
      action: "account:delete",
      identifier: session.user.id,
      limit: 3,
      windowSeconds: 86400,
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

    const parsed = deleteAccountSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
      );
    }

    const result = await tombstoneMyAccount(session, parsed.data);

    return apiSuccess({
      status: "deleted",
      deletedAt: result.deletedAt,
      authBanned: result.authBanned,
      avatarsRemoved: result.avatarsRemoved,
      signoutPath: result.signoutPath,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
