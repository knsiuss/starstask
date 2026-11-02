import { feedbackSubmissionSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import { createFeedback } from "@/lib/db/feedback";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Removes a query string and fragment from a reported page path.
 *
 * A URL can carry a token or a search term in its query; only the route itself
 * is useful for triage, so nothing after `?` or `#` is stored.
 */
function sanitizePagePath(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const path = value.split(/[?#]/)[0]?.trim();

  if (!path || !path.startsWith("/")) {
    return null;
  }

  return path.slice(0, 200);
}

/**
 * Stores a short feedback note from the signed-in user.
 *
 * The author is always the verified session user. No email, name, attachment,
 * or user agent is stored.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "feedback:submit",
      identifier: session.user.id,
      limit: 10,
      windowSeconds: 3600,
    });

    const parsed = feedbackSubmissionSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please check the feedback before sending it.",
        toFieldErrors(parsed.error),
      );
    }

    const entry = await createFeedback(session.user.id, {
      ...parsed.data,
      pagePath: sanitizePagePath(parsed.data.pagePath) ?? undefined,
    });

    return apiSuccess({ id: entry.id, status: entry.status }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
