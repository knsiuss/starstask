import { classDuplicateCheckSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { findClassDuplicates } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/**
 * Reports classes in the same academic period and institution whose code or
 * name matches. This only feeds a warning in the UI; it never creates, merges,
 * or modifies a class.
 */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();
    const params = new URL(request.url).searchParams;

    const parsed = classDuplicateCheckSchema.safeParse({
      name: params.get("name") ?? "",
      classCode: params.get("classCode") ?? undefined,
      academicYear: params.get("academicYear") ?? "",
      semester: params.get("semester") ?? "",
      institution: params.get("institution") ?? undefined,
      excludeClassId: params.get("excludeClassId") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Provide the class name, semester, and academic year to check for duplicates.",
        toFieldErrors(parsed.error),
      );
    }

    await enforceRateLimit({
      action: "classes:duplicates",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    return apiSuccess(await findClassDuplicates(parsed.data));
  } catch (error) {
    return handleRouteError(error);
  }
}
