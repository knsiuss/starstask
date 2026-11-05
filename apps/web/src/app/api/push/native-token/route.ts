import {
  nativePushTokenSchema,
  nativePushUnregisterSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { deleteNativePushToken, registerNativePushToken } from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const MAX_JSON_BYTES = 8 * 1024;

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiError(
      413,
      "payload_too_large",
      "The request body is too large.",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new ApiError(
      400,
      "invalid_json",
      "The request body could not be read.",
    );
  }
}

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
      action: "push:native-subscribe",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const parsed = nativePushTokenSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "This device token is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    // The RPC derives user_id from the verified session. A null result means
    // the token is already owned by a different account.
    const id = await registerNativePushToken(parsed.data);

    if (!id) {
      throw new ApiError(
        409,
        "token_conflict",
        "This device is already registered to another account. Sign out there first.",
      );
    }

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "push:native-unsubscribe",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = nativePushUnregisterSchema.safeParse(
      await readJsonBody(request),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "This device token is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    const deleted = await deleteNativePushToken(parsed.data.token);

    return apiSuccess({ removed: deleted });
  } catch (error) {
    return handleRouteError(error);
  }
}
