import type { PluginAdapter, PluginEvent } from "../types";
import { detectProgramId } from "./config";
import { unpamManifest } from "./manifest";

const KALENDER_URL = "https://ftiunpam.com/kalender";
const MENTARI_URL = "https://ftiunpam.com/elearning";
const PENGUMUMAN_URL = "https://ftiunpam.com/pengumuman";

const HEADERS = { "user-agent": "StarstaskPlugin/1.0 (+https://ftiunpam.com)" };

/** Umur cache fetch ke ftiunpam.com (sesuai fetch.md: next.revalidate). */
export const UNPAM_CACHE_SECONDS = 3600;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "02 November 2026" → ISO date string. */
export function parseIndonesianDate(value: string): string | null {
  const months: Record<string, string> = {
    Januari: "01",
    Februari: "02",
    Maret: "03",
    April: "04",
    Mei: "05",
    Juni: "06",
    Juli: "07",
    Agustus: "08",
    September: "09",
    Oktober: "10",
    November: "11",
    Desember: "12",
  };

  const match = value.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);

  if (!match) {
    return null;
  }

  const day = match[1];
  const monthName = match[2];
  const year = match[3];

  if (!day || !monthName || !year) {
    return null;
  }

  const month = months[monthName];

  if (!month) {
    return null;
  }

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

/** Semua tanggal Indonesia di teks, berurutan, tanpa duplikat. */
export function findIndonesianDates(text: string): string[] {
  const found: string[] = [];
  const pattern =
    /\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}/g;

  for (const match of text.matchAll(pattern)) {
    const iso = parseIndonesianDate(match[0]);

    if (iso && !found.includes(iso)) {
      found.push(iso);
    }
  }

  return found;
}

/** Ambil baris tabel kalender: [tanggal awal, tanggal akhir, kegiatan]. */
export function parseKalenderRows(html: string): PluginEvent[] {
  const rows: PluginEvent[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    if (!rowHtml) {
      continue;
    }

    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => {
        const raw = cell[1];

        return raw ? stripTags(raw) : "";
      },
    );

    if (cells.length < 3) {
      continue;
    }

    const startRaw = cells[1] ?? "";
    const endRaw = cells[2] ?? "";
    const title = cells[3] ?? "";
    const startsAt = parseIndonesianDate(startRaw);
    const endsAt = parseIndonesianDate(endRaw);

    if (!startsAt || !title) {
      continue;
    }

    rows.push({
      title,
      startsAt,
      endsAt,
      location: null,
      description: null,
      sourceUrl: KALENDER_URL,
      programId: detectProgramId(title),
      kind: "academic-calendar",
    });
  }

  return rows;
}

/** Ambil periode daring MENTARI, mis. "Periode Daring 02-11-2026 s.d 06-11-2026". */
export function parseMentariPeriods(html: string): PluginEvent[] {
  const text = stripTags(html);
  const windows = [
    ...text.matchAll(
      /Periode Daring (\d{2}-\d{2}-\d{4}) s\.d (\d{2}-\d{2}-\d{4})/gi,
    ),
  ];
  const events: PluginEvent[] = [];
  const toIso = (value: string) => {
    const [day, month, year] = value.split("-");

    return day && month && year ? `${year}-${month}-${day}` : null;
  };

  for (const [index, match] of windows.entries()) {
    const startRaw = match[1] ?? "";
    const endRaw = match[2] ?? "";
    const startsAt = toIso(startRaw);
    const endsAt = toIso(endRaw);

    if (!startsAt) {
      continue;
    }

    events.push({
      title: `Periode Daring MENTARI #${index + 1}`,
      startsAt,
      endsAt,
      location: null,
      description: `Periode daring ${startRaw} s.d ${endRaw}`,
      sourceUrl: MENTARI_URL,
      programId: "semua",
      kind: "e-learning",
    });
  }

  // Pertemuan kembali, mis. "2 SKS - Pertemuan 9".
  const meetings = [...text.matchAll(/(\d SKS - Pertemuan [\d &]+)/g)];

  if (events[0]) {
    const pertemuans = [
      ...new Set(meetings.map((m) => m[1] ?? "").filter(Boolean)),
    ];

    if (pertemuans.length > 0) {
      events[0].description = `${events[0].description ?? ""} • ${pertemuans.join(" • ")}`;
    }
  }

  return events;
}

/**
 * Totong judul pengumuman dari awal blok: kalimat pertama sebelum titik,
 * dibatasi 120 karakter. Teks bebas FTI tidak punya struktur tetap, jadi ini
 * heuristic yang disengaja; fallback ke 80 karakter pertama bila tak ada titik.
 */
export function extractAnnouncementTitle(block: string): string {
  const firstSentence = block.split(".")[0]?.trim() ?? "";
  const candidate =
    firstSentence.length >= 8 ? firstSentence : block.slice(0, 80);

  return candidate.trim().slice(0, 120);
}

/**
 * Pengumuman di ftiunpam.com berupa teks bebas berblok "INFORMASI ...".
 * Judul = kalimat pertama blok; tanggal = semua tanggal Indonesia di blok
 * (biasanya tanggal daftar & tanggal acara). Link deep-link tetap ke
 * /pengumuman karena halaman tidak punya URL per-pengumuman.
 */
export function parsePengumuman(html: string): PluginEvent[] {
  const text = stripTags(html);
  const blocks = text
    .split(/INFORMASI /)
    .map((block) => block.trim())
    .filter(Boolean);
  const events: PluginEvent[] = [];

  for (const block of blocks) {
    const title = extractAnnouncementTitle(block);

    if (!title) {
      continue;
    }

    const dates = findIndonesianDates(block);
    const startsAt = dates[0] ?? new Date().toISOString().slice(0, 10);
    const endsAt = dates[dates.length - 1] ?? null;

    events.push({
      title,
      startsAt,
      endsAt: endsAt && endsAt !== startsAt ? endsAt : null,
      location: null,
      description: block.slice(0, 600),
      sourceUrl: PENGUMUMAN_URL,
      programId: detectProgramId(block),
      kind: "events",
    });
  }

  return events;
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: UNPAM_CACHE_SECONDS, tags: [`unpam:${url}`] },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Sanitized category only: the URL is internal config, and this error is
    // persisted into plugin status visible to class members (QA-10).
    throw new Error(`UPSTREAM_FETCH_FAILED:${response.status}`);
  }

  const body = await response.text();

  if (body.length > MAX_HTML_BYTES) {
    throw new Error("UPSTREAM_FETCH_TOO_LARGE");
  }

  return body;
}

/** Gabungan kalender + MENTARI info + pengumuman. Per-sumber gagal = skip. */
export async function fetchUnpamEvents(): Promise<PluginEvent[]> {
  const [kalender, mentari, pengumuman] = await Promise.allSettled([
    fetchHtml(KALENDER_URL).then(parseKalenderRows),
    fetchHtml(MENTARI_URL).then(parseMentariPeriods),
    fetchHtml(PENGUMUMAN_URL).then(parsePengumuman),
  ]);

  const combine = (result: PromiseSettledResult<PluginEvent[]>) =>
    result.status === "fulfilled" ? result.value : [];

  const all = [
    ...combine(kalender),
    ...combine(mentari),
    ...combine(pengumuman),
  ];

  return all.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Adapter UNPAM / FTI. Hanya fetch halaman publik, tidak menulis ke DB.
 * LMS MENTARI (isi mata kuliah) tidak di-scrape.
 */
export const unpamPlugin: PluginAdapter = {
  manifest: unpamManifest,
  fetchEvents: fetchUnpamEvents,
};

export const mentariUrl = MENTARI_URL;
export const pengumumanUrl = PENGUMUMAN_URL;
export const kalenderUrl = KALENDER_URL;
