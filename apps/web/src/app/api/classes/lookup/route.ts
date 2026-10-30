import { classSlugSchema } from "@starstask/contracts";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getClassBySlug } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

/** Resolves a typed class code (slug) to an active class the form can submit. */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:lookup",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 60,
    });

    const url = new URL(request.url);
    const parsed = classSlugSchema.safeParse(
      url.searchParams.get("code") ?? "",
    );

    if (!parsed.success) {
      throw new ApiError(422, "validation_error", "Enter a valid class code.", {
        code: parsed.error.issues[0]?.message ?? "Invalid class code.",
      });
    }

    const found = await getClassBySlug(parsed.data);

    if (!found || found.status !== "active") {
      throw new ApiError(
        404,
        "not_found",
        "No active class matches that code.",
      );
    }

    return apiSuccess({
      id: found.id,
      slug: found.slug,
      name: found.name,
      semester: found.semester,
      academicYear: found.academic_year,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = "nodejs";
