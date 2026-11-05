import { apiError, apiSuccess } from "@/lib/api/responses";
import { isUnpamPluginEnabled } from "@/features/plugins/unpam/config";
import { fetchUnpamEvents } from "@/features/plugins/unpam/adapter";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

// Cron menghangatkan cache server; jangan di-cache CDN.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/unpam-sync
 *
 * Vercel Cron (jadwal di apps/web/vercel.json): fetch + parse ketiga halaman
 * publik ftiunpam.com lewat adapter agar cache `next.revalidate` terisi.
 * Tidak menulis ke DB dan tidak menyentuh LMS MENTARI.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError(401, "unauthorized", "Invalid scheduler credentials.");
  }

  if (!isUnpamPluginEnabled()) {
    return apiSuccess({ pluginId: "unpam", enabled: false, count: 0 });
  }

  const events = await fetchUnpamEvents().catch(() => []);
  const byKind = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.kind] = (acc[event.kind] ?? 0) + 1;
    return acc;
  }, {});

  return apiSuccess({
    pluginId: "unpam",
    enabled: true,
    count: events.length,
    byKind,
  });
}
