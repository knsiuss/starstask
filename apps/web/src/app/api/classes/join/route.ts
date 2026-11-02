import { classJoinByNameSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { DataAccessError } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { joinClassByName } from "@/lib/db/profiles";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 2 * 1024;

/**
 * Joins an open class by the name or code the student typed.
 *
 * Every policy decision lives in `join_class_by_name`: it matches active
 * classes, refuses `join_policy = 'invitation'` classes, treats a retry as a
 * no-op, and never writes `class_admins`. This handler only validates the input
 * and forwards the discriminated result, so the UI can explain exactly why a
 * join did or did not happen.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:join-by-name",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 300,
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

    const parsed = classJoinByNameSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Enter a class name.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await joinClassByName(parsed.data.className);

    return apiSuccess({ result });
  } catch (error) {
    // A failure inside the RPC is a domain error, not a crash: say so instead
    // of the generic 500, and name the database code while developing so a
    // broken deployment is diagnosable without reading the server log.
    // Logged as a string: the dev logger serialises an object argument as
    // `{}`, which hid the real cause of an earlier failure on this route.
    console.error(
      `[classes:join] ${error instanceof Error ? error.name : typeof error}: ` +
        `${error instanceof Error ? error.message : "unknown"}` +
        `${error instanceof DataAccessError ? ` (${error.code})` : ""}`,
    );

    if (error instanceof DataAccessError) {
      return apiError(
        503,
        "join_unavailable",
        process.env.NODE_ENV === "production"
          ? "Could not check that class right now. Please try again."
          : `Could not check that class right now (${error.code}).`,
      );
    }

    return handleRouteError(error);
  }
}
