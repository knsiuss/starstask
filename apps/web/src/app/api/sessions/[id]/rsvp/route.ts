import {
  sessionIdSchema,
  sessionRsvpSchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { cancelRsvp, rsvpSession } from "@/features/sessions/session-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Sets the caller's RSVP.
 *
 * The user id never comes from the body: `rsvp_discussion_session` reads
 * `auth.uid()`, so a forged payload cannot register somebody else.
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    const { id } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    await enforceRateLimit({
      action: "sessions:rsvp",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = sessionRsvpSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose going, maybe, or not going.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await rsvpSession(parsedId.data, parsed.data.status);

    return apiSuccess({ attendance: result });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Removes the caller's RSVP entirely. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }

    const { id } = await context.params;
    const parsedId = sessionIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw notFound();
    }

    await enforceRateLimit({
      action: "sessions:rsvp",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const removed = await cancelRsvp(parsedId.data);

    return apiSuccess({ removed });
  } catch (error) {
    return handleRouteError(error);
  }
}
