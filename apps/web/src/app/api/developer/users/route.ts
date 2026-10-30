import { developerUsersQuerySchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireDeveloperApiAccess } from "@/lib/auth/developer";
import { listDeveloperUsers } from "@/lib/db/developer";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireDeveloperApiAccess();

    await enforceRateLimit({
      action: "developer:users",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 60,
    });

    if (!isServiceRoleConfigured()) {
      throw serviceUnavailable();
    }

    const url = new URL(request.url);
    const parsed = developerUsersQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_query",
        "One or more directory filters are invalid.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await listDeveloperUsers(parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
