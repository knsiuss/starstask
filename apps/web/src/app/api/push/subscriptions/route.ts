import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import {
  deletePushDeviceByEndpoint,
  registerPushSubscription,
} from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { isPushConfigured } from "@/lib/push/config";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const MAX_JSON_BYTES = 8 * 1024;

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    if (!isPushConfigured()) {
      throw new ApiError(
        503,
        "push_unavailable",
        "Push notifications are not configured on this deployment.",
      );
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "push:subscribe",
      identifier: session.user.id,
      limit: 30,
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

    const parsed = pushSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "This browser subscription is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    // The RPC derives user_id from the verified session. A null result means
    // the endpoint is already owned by a different account.
    const id = await registerPushSubscription(parsed.data);

    if (!id) {
      throw new ApiError(
        409,
        "subscription_conflict",
        "This browser is already registered to another account. Sign out there first.",
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
      action: "push:unsubscribe",
      identifier: session.user.id,
      limit: 60,
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

    const parsed = pushUnsubscribeSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "This browser subscription is not valid.",
        toFieldErrors(parsed.error),
      );
    }

    const deleted = await deletePushDeviceByEndpoint(parsed.data.endpoint);

    // Idempotent: the browser may have already dropped the subscription, and
    // a repeated unsubscribe must not look like a failure.
    return apiSuccess({ removed: deleted });
  } catch (error) {
    return handleRouteError(error);
  }
}
