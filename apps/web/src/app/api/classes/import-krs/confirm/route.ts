import { krsImportConfirmSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { DataAccessError } from "@/lib/db/assignments";
import { importKrsClass } from "@/lib/db/krs-import";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 64 * 1024;

/**
 * Provisions a class, its non-duplicate subjects, and its weekly schedule
 * slots from a reviewed KRS import payload.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:import-krs:confirm",
      identifier: session.user.id,
      limit: 10,
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

    const parsed = krsImportConfirmSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const result = await importKrsClass(session.user.id, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    console.error(
      `[classes:import-krs:confirm] ${error instanceof Error ? error.name : typeof error}` +
        `${error instanceof DataAccessError ? ` (${error.code})` : ""}`,
    );

    if (error instanceof DataAccessError) {
      if (error.code === "P0001") {
        return apiError(
          409,
          "self_organized_limit",
          "You already own 8 active self-organized classes.",
        );
      }

      if (error.code === "42501") {
        return apiError(
          403,
          "forbidden",
          "You cannot create a class for that university.",
        );
      }

      if (error.code === "22023") {
        return apiError(422, "validation_error", "Check the fields you typed.");
      }

      return apiError(
        503,
        "create_unavailable",
        process.env.NODE_ENV === "production"
          ? "Could not import your class right now. Please try again."
          : `Could not import your class right now (${error.code}).`,
      );
    }

    return handleRouteError(error);
  }
}
