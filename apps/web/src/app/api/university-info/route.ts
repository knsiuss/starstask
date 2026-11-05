import { notFound, serviceUnavailable } from "@/lib/api/errors";
import { handleRouteError, publicJson } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session";
import {
  isUnpamPluginEnabled,
  isUnpamUniversity,
  parseProgramParam,
} from "@/features/plugins/unpam/config";
import { fetchUnpamEvents } from "@/features/plugins/unpam/adapter";
import { isSupabaseConfigured } from "@/lib/env/public";

// Respons cache CDN 1 jam; fetch ke ftiunpam.com juga revalidate 3600 dtk.
export const dynamic = "force-dynamic";

/**
 * GET /api/university-info?program=semua|ti|manajemen
 *
 * Hanya untuk pengguna UNPAM dengan plugin aktif. Data diambil server-side
 * lewat adapter (cache `next.revalidate` 3600), jadi browser tidak pernah
 * menghubungi ftiunpam.com langsung.
 */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    if (!isUnpamPluginEnabled()) {
      throw notFound();
    }

    const session = await getSessionUser();

    if (!session || !isUnpamUniversity(session.profile?.university)) {
      throw notFound();
    }

    const program = parseProgramParam(
      new URL(request.url).searchParams.get("program") ?? undefined,
    );

    const events = await fetchUnpamEvents().catch(() => []);
    const filtered =
      program === "semua"
        ? events
        : events.filter(
            (event) =>
              event.programId === program || event.programId === "semua",
          );

    return publicJson(
      {
        pluginId: "unpam",
        program,
        count: filtered.length,
        events: filtered.slice(0, 100),
      },
      3600,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
