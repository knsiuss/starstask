import { serviceUnavailable, unauthorized } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import { listNotificationInbox } from "@/lib/db/notifications";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 20;

/** Cursor page of the caller's inbox; the owner is always the verified session. */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await getSessionUser();

    if (!session) {
      throw unauthorized();
    }

    await enforceRateLimit({
      action: "notifications:list",
      identifier: session.user.id,
      limit: 240,
      windowSeconds: 3600,
    });

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const unreadOnly = url.searchParams.get("filter") === "unread";

    const result = await listNotificationInbox({
      page: 1,
      pageSize: PAGE_SIZE,
      unreadOnly,
      cursor: cursor ?? null,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
