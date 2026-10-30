import { serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireDeveloperApiAccess } from "@/lib/auth/developer";
import { getDeveloperHealth, getDeveloperMetrics } from "@/lib/db/developer";
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
      action: "developer:overview",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 60,
    });

    if (!isServiceRoleConfigured()) {
      throw serviceUnavailable();
    }

    const [metrics, health] = await Promise.all([
      getDeveloperMetrics(),
      getDeveloperHealth(),
    ]);

    return apiSuccess({ metrics, health });
  } catch (error) {
    return handleRouteError(error);
  }
}
