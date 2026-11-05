/**
 * Konfigurasi plugin UNPAM/FTI.
 *
 * Toggle admin lewat env `UNPAM_PLUGIN_ENABLED` (default on): hanya nilai
 * false/0/off/no/disabled yang mematikan. Env dipilih supaya tidak perlu
 * tabel/migrasi baru; halaman `/settings/plugins` menampilkan status ini
 * untuk platform admin.
 */

export type ProgramId = "ti" | "manajemen" | "semua";

export const PROGRAM_LABELS: Record<ProgramId, string> = {
  ti: "Teknik Informatika",
  manajemen: "Manajemen",
  semua: "Semua Jurusan",
};

export function isUnpamPluginEnabled(): boolean {
  const raw = process.env.UNPAM_PLUGIN_ENABLED;

  if (raw === undefined) {
    return true;
  }

  return !new Set(["0", "false", "off", "no", "disabled"]).has(
    raw.trim().toLowerCase(),
  );
}

/** True bila teks university di profil menunjuk ke UNPAM. */
export function isUnpamUniversity(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();

  return text.includes("pamulang") || text.includes("unpam");
}

/**
 * Totong program dari teks event: sebut "Teknik Informatika"/"TI" -> ti,
 * "Manajemen" -> manajemen, selain itu semua jurusan. Cukup untuk info publik
 * FTI; tanpa kolom jurusan per pengguna, halaman memakai filter `?program=`.
 */
export function detectProgramId(text: string): ProgramId {
  const lower = text.toLowerCase();

  if (/teknik\s+informatika|\bti\b|informatika/.test(lower)) {
    return "ti";
  }

  if (/manajemen/.test(lower)) {
    return "manajemen";
  }

  return "semua";
}

/** Filter event sesuai program terpilih (`semua` = tampil semua). */
export function filterEventsByProgram<T extends { programId: ProgramId }>(
  events: T[],
  program: string | null | undefined,
): T[] {
  if (!program || program === "semua") {
    return events;
  }

  if (program === "ti" || program === "manajemen") {
    return events.filter(
      (event) => event.programId === program || event.programId === "semua",
    );
  }

  return events;
}

/** Parse param `?program=` ke ProgramId valid, default "semua". */
export function parseProgramParam(
  value: string | string[] | undefined,
): ProgramId {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "ti" || raw === "manajemen") {
    return raw;
  }

  return "semua";
}
