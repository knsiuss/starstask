import { announcementUpdateSchema, toFieldErrors } from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { requireClassPermission } from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { updateAnnouncement } from "@/lib/db/announcements";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Partially edits an announcement (title/body/pin/publish/archive). Gated by
 * `manage_announcements`. Announcements of another class answer 404.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; announcementId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Supabase is not configured.",
      );
    }

    const { slug, announcementId } = await context.params;
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

    if (!/^[0-9a-f-]{36}$/i.test(announcementId)) {
      throw new ApiError(404, "not_found", "Announcement not found.");
    }

    await enforceRateLimit({
      action: "classes:announcements:update",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 3600,
    });

    const parsed = announcementUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_error",
        "Check the announcement update.",
        toFieldErrors(parsed.error),
      );
    }

    const service = requireServiceRoleClient();
    const outcome = await updateAnnouncement(
      service,
      session.user.id,
      found.id,
      found.universityId,
      announcementId,
      parsed.data,
    );

    if (outcome === "not_found") {
      throw new ApiError(404, "not_found", "Announcement not found.");
    }

    return apiSuccess({ updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
