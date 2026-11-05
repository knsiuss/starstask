import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import { recordAnnouncementRead } from "@/lib/db/announcements";
import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Marks an announcement as read for the caller. The announcement must be
 * visible under RLS (class members and platform admins only); non-members
 * receive 404, mirroring the read policy.
 */
export async function POST(
  _request: Request,
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

    const { announcementId } = await context.params;

    if (!/^[0-9a-f-]{36}$/i.test(announcementId)) {
      throw new ApiError(404, "not_found", "Announcement not found.");
    }

    const session = await getSessionUser();

    if (!session) {
      throw new ApiError(401, "unauthorized", "Sign in required.");
    }

    await enforceRateLimit({
      action: "classes:announcements:read",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const supabase = await createSupabaseServerClient();
    const { data: announcement, error } = await supabase
      .from("announcements")
      .select("id, university_id")
      .eq("id", announcementId)
      .maybeSingle();

    if (error) {
      throw new ApiError(
        500,
        "internal_error",
        "Could not load the announcement.",
      );
    }

    if (!announcement) {
      throw new ApiError(404, "not_found", "Announcement not found.");
    }

    const service = requireServiceRoleClient();

    await recordAnnouncementRead(
      service,
      session.user.id,
      announcement.id,
      announcement.university_id,
    );

    return apiSuccess({ read: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
