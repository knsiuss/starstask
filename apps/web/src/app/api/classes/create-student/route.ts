import { studentCreateClassSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/responses";
import { DataAccessError } from "@/lib/db/assignments";
import { createClassAsStudent } from "@/lib/db/profiles";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_JSON_BYTES = 8 * 1024;

/**
 * Self-organized class creation for any signed-in user.
 *
 * Every rule lives in `create_class_as_student`: slug format, field lengths,
 * the 3-active-class abuse cap (P0001), and the creator's own membership with
 * `joined_via = 'student_created'` so the ketua trigger names them ketua.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:create-student",
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

    const parsed = studentCreateClassSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const classId = await createClassAsStudent(parsed.data);

    return apiSuccess({ classId });
  } catch (error) {
    console.error(
      `[classes:create-student] ${error instanceof Error ? error.name : typeof error}: ` +
        `${error instanceof Error ? error.message : "unknown"}` +
        `${error instanceof DataAccessError ? ` (${error.code})` : ""}`,
    );

    if (error instanceof DataAccessError) {
      if (error.code === "P0001") {
        return apiError(
          409,
          "self_organized_limit",
          "You already own 3 active self-organized classes.",
        );
      }

      if (error.code === "23505") {
        return apiError(
          409,
          "slug_taken",
          "That class code is already in use.",
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
          ? "Could not create your class right now. Please try again."
          : `Could not create your class right now (${error.code}).`,
      );
    }

    return handleRouteError(error);
  }
}
