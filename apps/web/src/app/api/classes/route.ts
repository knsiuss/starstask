import {
  classDiscoveryQuerySchema,
  toFieldErrors,
} from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { handleRouteError, publicJson } from "@/lib/api/responses";
import { listClasses } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Public class discovery: active classes only, no sign-in required. */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    await enforceRateLimit({
      action: "classes:list",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
    });

    const url = new URL(request.url);
    const parsed = classDiscoveryQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_query",
        "One or more filters are invalid.",
        toFieldErrors(parsed.error),
      );
    }

    return publicJson(await listClasses(parsed.data), 60);
  } catch (error) {
    return handleRouteError(error);
  }
}
