import { z } from "zod";

import {
  ApiError,
  notFound,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { deletePushDevice } from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const deviceIdSchema = z.uuid("Invalid device id");

type RouteContext = { params: Promise<{ id: string }> };

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
      action: "push:unsubscribe",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = deviceIdSchema.safeParse((await context.params).id);

    if (!parsed.success) {
      throw new ApiError(400, "invalid_id", "The device id is invalid.");
    }

    const deleted = await deletePushDevice(session.user.id, parsed.data);

    if (!deleted) {
      throw notFound();
    }

    return apiSuccess({ id: parsed.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
