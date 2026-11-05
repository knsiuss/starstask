import { announcementCreateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import {
  createAnnouncement,
  InvalidOfferingError,
} from "@/lib/db/announcements";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Publishes (or drafts) a class-scoped announcement. Gated by
 * `manage_announcements`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassPermission(
      slug,
      "manage_announcements",
    );

    if (!found.universityId) {
      throw new ApiError(
        409,
        "class_unlinked",
        "This class is not linked to a university yet.",
      );
    }

    await enforceRateLimit({
      action: "classes:announcements:create",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3600,
    });

    const parsed = announcementCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the announcement.",
        toFieldErrors(parsed.error),
      );
    }

    const service = requireServiceRoleClient();

    try {
      const result = await createAnnouncement(
        service,
        session.user.id,
        found.id,
        found.universityId,
        parsed.data,
      );

      return apiSuccess(result, 201);
    } catch (error) {
      if (error instanceof InvalidOfferingError) {
        throw new ApiError(422, "invalid_offering", error.message);
      }

      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
