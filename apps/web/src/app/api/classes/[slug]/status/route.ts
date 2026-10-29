import { classStatusUpdateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  requireClass,
  requirePlatformAdmin,
} from "@/features/classes/class-access";
import { setClassStatus } from "@/features/classes/class-management-service";

export const dynamic = "force-dynamic";

/**
 * Archives or restores a class. Only platform admins may change class status;
 * the database function enforces the same rule.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requirePlatformAdmin();
    const { slug } = await context.params;
    const found = await requireClass(slug);

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
