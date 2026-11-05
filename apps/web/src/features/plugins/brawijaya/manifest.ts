import type { PluginManifest } from "../types";

/**
 * Brawijaya plugin manifest — STUB, belum aktif.
 * Pola sama seperti UNPAM: tambah adapter + daftarkan di registry saat sumber
 * resmi (domain kalender) dikonfirmasi. Belum ada fetch, jadi tidak ada di registry.
 */
export const brawijayaManifest: PluginManifest = {
  pluginId: "brawijaya",
  displayName: "Universitas Brawijaya",
  domains: ["ub.ac.id"],
  sources: [
    {
      kind: "academic-calendar",
      url: "https://ub.ac.id",
      requiresLogin: false,
      syncIntervalHours: 24 * 7,
    },
  ],
};
