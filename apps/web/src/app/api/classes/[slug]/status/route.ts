import { classStatusUpdateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { setClassStatus } from "@/features/classes/class-management-service";

export const dynamic = "force-dynamic";

/**
 * Activates, archives, or restores a class. Class admins may change the
 * lifecycle of their own class; platform admins may change any class. The
 * database function re-checks the same rule and rejects invalid transitions.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "classes:status",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = classStatusUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Choose a valid class status.",
        toFieldErrors(parsed.error),
      );
    }

    await setClassStatus(found.id, parsed.data);

    return apiSuccess({ id: found.id, status: parsed.data.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
