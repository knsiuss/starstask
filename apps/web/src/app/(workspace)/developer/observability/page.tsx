import type { Metadata } from "next";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/features/classes/class-access";
import { getUnpamSyncStatus } from "@/lib/db/plugins";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Observability",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  // Views are not in generated Database types yet — cast via admin path in lib.
  const { getObservabilityViews } = await import("@/lib/db/plugins");
  const views = await getObservabilityViews();
  const [drift, nim, gap, sync] = [
    { data: views.drift },
    { data: views.nim },
    { data: views.gap },
    await getUnpamSyncStatus(),
  ] as const;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Observability</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Tenant gaps, dual-write drift, NIM drift, plugin sync. Gratis, tanpa
        layanan berbayar.
      </p>
      <div className="mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dual-write drift</CardTitle>
          </CardHeader>
          <p className="text-sm">
            Legacy: {(drift.data as any)?.legacy_members ?? "-"} • Baru:{" "}
            {(drift.data as any)?.new_memberships ?? "-"} • Tanpa mirror:{" "}
            {(drift.data as any)?.legacy_without_new ?? "-"}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>NIM drift</CardTitle>
          </CardHeader>
          <p className="text-sm">
            Total: {(nim.data as any)?.identities_total ?? "-"} • Prefixed:{" "}
            {(nim.data as any)?.prefixed ?? "-"} • Unprefixed:{" "}
            {(nim.data as any)?.unprefixed ?? "-"}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tenant gap</CardTitle>
          </CardHeader>
          <ul className="text-sm">
            {(gap.data ?? []).map((r: any) => (
              <li key={r.source}>
                {r.source}: {r.null_university_rows} NULL
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plugin sync (UNPAM)</CardTitle>
          </CardHeader>
          <p className="text-sm">
            Last: {sync?.last_success_at ?? sync?.last_attempt_at ?? "belum"} •{" "}
            {sync?.event_count ?? 0} event
            {sync?.last_error ? ` • Error: ${sync.last_error}` : ""}
          </p>
        </Card>
      </div>
    </div>
  );
}
