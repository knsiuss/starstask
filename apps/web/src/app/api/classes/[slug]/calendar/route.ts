import { notFound, serviceUnavailable } from "@/lib/api/errors";
import { handleRouteError } from "@/lib/api/responses";
import { getClassCalendarFeed } from "@/lib/db/class-calendar";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSession } from "@/features/classes/class-access";
import { buildIcsCalendar } from "@starstask/shared";

export const dynamic = "force-dynamic";

/** Signed-in calendar export with no shared caching of assignment data. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:calendar",
      identifier: session.user.id,
      limit: 120,
      windowSeconds: 60,
    });

    const feed = await getClassCalendarFeed(slug);

    if (!feed) {
      throw notFound();
    }

    const calendar = buildIcsCalendar({
      name: `${feed.courseName} · ${feed.name}`,
      description: `Assignment deadlines and sessions for ${feed.name} on StarsTask.`,
      events: feed.events,
    });

    return new Response(calendar, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="starstask-${feed.slug}.ics"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
