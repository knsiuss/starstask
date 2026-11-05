/**
 * Plugin contract untuk semua integrasi. Setiap plugin hanya
 * fetch + normalize, tidak boleh menulis langsung ke DB. Sync ke
 * jadwal/event dilakukan lewat jalur resmi yang sudah ada.
 */

export type PluginKind =
  "academic-calendar" | "faculty-schedule" | "events" | "e-learning";

export type PluginSource = {
  kind: PluginKind;
  /** URL publik / endpoint resmi; jangan taruh kredensial di sini. */
  url: string;
  requiresLogin: boolean;
  /** 0 = manual sync, >0 = jam interval sync (cron). */
  syncIntervalHours: number;
};

export type PluginManifest = {
  pluginId: string;
  displayName: string;
  domains: string[];
  sources: PluginSource[];
};

/** Bentuk normal hasil fetch, sebelum disimpan ke tabel jadwal. */
export type PluginEvent = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  sourceUrl: string | null;
  /** Tag program/jurusan: "ti" | "manajemen" | "semua". */
  programId: "ti" | "manajemen" | "semua";
  /** Kategori sumber: kalender, mentari, atau pengumuman. */
  kind: "academic-calendar" | "e-learning" | "events";
};

export type PluginAdapter = {
  manifest: PluginManifest;
  fetchEvents: () => Promise<PluginEvent[]>;
};
