import { classApplicationCreateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireSession } from "@/features/classes/class-access";
import { submitClassApplication } from "@/features/classes/class-application-service";
import { listMyApplications } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** The caller's own class applications, newest first. */
export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:applications:list",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    return apiSuccess(await listMyApplications(session.user.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Submits a class application.
 *
 * The applicant is always the verified session user; no id is accepted from
 * the body, and approval requires a platform admin.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:applications:create",
      identifier: session.user.id,
      limit: 5,
      windowSeconds: 3600,
    });

    const parsed = classApplicationCreateSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Please fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await submitClassApplication(parsed.data);

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
