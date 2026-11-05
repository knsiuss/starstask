import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listPlugins } from "@/features/plugins";
import { isUnpamPluginEnabled } from "@/features/plugins/unpam/config";
import { requirePlatformAdmin } from "@/features/classes/class-access";

export const metadata: Metadata = {
  title: "Plugin settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Toggle plugin untuk platform admin. Toggle nyata memakai env
 * `UNPAM_PLUGIN_ENABLED` (default on): set false/0/off/no/disabled + rebuild
 * untuk mematikan. Halaman ini hanya menampilkan status dan manifest plugin,
 * bukan menulis DB — sesuai batas Phase 3 (tanpa DDL/konfig produksi).
 */
export default async function PluginSettingsPage() {
  await requirePlatformAdmin();

  const plugins = listPlugins();
  const enabled = isUnpamPluginEnabled();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Plugin settings
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Dokumen ini mengatur integrasi kampus (mis. UNPAM/FTI) yang memberi
          menu University Info di sidebar.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              UNPAM / FTI
              <Badge variant={enabled ? "success" : "danger"}>
                {enabled ? "Aktif" : "Nonaktif"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <p className="text-muted-foreground text-sm">
            Sumber: kalender akademik, info MENTARI, pengumuman (publik, tanpa
            login). LMS MENTARI (isi mata kuliah) tidak di-scrape.
          </p>
          <p className="mt-2 text-sm">
            Untuk mematikan: set{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">
              UNPAM_PLUGIN_ENABLED=false
            </code>{" "}
            lalu rebuild/deploy. Menu University Info hilang dari sidebar;
            halaman dan API-nya mengembalikan 404.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Env aktif saat ini:{" "}
            <code className="bg-muted rounded px-1 py-0.5">
              {process.env.UNPAM_PLUGIN_ENABLED ?? "(kosong = aktif)"}
            </code>
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plugin terdaftar ({plugins.length})</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {plugins.map((plugin) => (
              <li
                key={plugin.manifest.pluginId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">
                  {plugin.manifest.displayName}
                </span>
                <span className="text-muted-foreground text-xs">
                  {plugin.manifest.sources.length} sumber •{" "}
                  {plugin.manifest.domains.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Alert variant="info">
          Toggle per-admin di UI belum tersedia karena butuh tabel/migrasi baru;
          batas Phase 3 melarang perubahan DDL produksi tanpa persetujuan. Jalur
          env ini cukup sebagai kill-switch sampai migrasi disetujui.{" "}
        </Alert>
      </div>
    </div>
  );
}
