import {
  notificationPreferencesSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import {
  getNotificationPreferences,
  listPushDevices,
  updateNotificationPreferences,
} from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const MAX_JSON_BYTES = 4 * 1024;

export async function GET() {
  try {
    const session = await requireSession();
    const [preferences, devices] = await Promise.all([
      getNotificationPreferences(session.user.id),
      listPushDevices(session.user.id),
    ]);

    return apiSuccess({ preferences, devices });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();

    await enforceRateLimit({
      action: "push:preferences",
      identifier: session.user.id,
      limit: 60,
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

    const parsed = notificationPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const preferences = await updateNotificationPreferences(
      session.user.id,
      parsed.data,
    );

    return apiSuccess({ preferences });
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
