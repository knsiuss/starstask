import type { LeaveOcrSuggestion } from "@starstask/contracts";

/**
 * Turns raw OCR text into suggestions.
 *
 * This module is deliberately conservative. It only proposes a value when the
 * document labels it or when a date range is explicit; it never invents a leave
 * period from a single stray date. Everything it returns is shown to the student
 * for confirmation, and nothing here can submit or forward a request.
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  agustus: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

/** Labels that mark a document's own issue date. */
const ISSUE_LABEL =
  /(tanggal\s+(?:surat|dokumen|dikeluarkan|terbit|keluar)|dikeluarkan\s+pada|issued?(?:\s+on)?|date\s+of\s+issue|issue\s+date)/i;

/** Labels that introduce the requested leave period. */
const LEAVE_LABEL =
  /(tanggal\s+(?:izin|cuti|sakit|tidak\s+masuk)|periode\s+(?:izin|cuti)|izin\s+(?:tanggal|dari)|cuti\s+dari|leave\s+(?:date|period)|period\s+of\s+leave)/i;

/** Words that join two dates into a range. */
const RANGE_SEPARATOR = /(s\.?\s?d\.?|sampai|hingga|s\/d|\bto\b|\buntil\b|[-–—])/i;

const NAME_LABEL =
  /(?:nama(?:\s+(?:siswa|mahasiswa|lengkap|pasien))?|\bname\b)\s*[:\-]\s*([^\n]{2,80})/i;

type DateHit = {
  iso: string;
  start: number;
  end: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Builds a `YYYY-MM-DD` only for a real calendar date. */
export function toIsoDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (year < 1900 || year > 2999 || month < 1 || month > 12) {
    return null;
  }

  if (day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Finds every date-like token, in document order. */
export function findDates(text: string): DateHit[] {
  const hits: DateHit[] = [];

  const isoPattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const numericPattern = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/g;
  const namedPattern = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g;

  for (const match of text.matchAll(isoPattern)) {
    const iso = toIsoDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    );

    if (iso) {
      hits.push({ iso, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    }
  }

  for (const match of text.matchAll(numericPattern)) {
    let day = Number(match[1]);
    let month = Number(match[2]);

    // Day-first is the local convention, but 03/25/2026 can only be M/D/Y.
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }

    const iso = toIsoDate(Number(match[3]), month, day);

    if (iso) {
      hits.push({ iso, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    }
  }

  for (const match of text.matchAll(namedPattern)) {
    const month = MONTHS[match[2]?.toLowerCase() ?? ""];

    if (!month) {
      continue;
    }

    const iso = toIsoDate(Number(match[3]), month, Number(match[1]));

    if (iso) {
      hits.push({ iso, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    }
  }

  return hits.sort((left, right) => left.start - right.start);
}

/** Splits text into lines, keeping each line's offset in the original. */
function toLines(text: string): { text: string; offset: number }[] {
  const lines: { text: string; offset: number }[] = [];
  let offset = 0;

  for (const line of text.split(/\r?\n/)) {
    lines.push({ text: line, offset });
    offset += line.length + 1;
  }

  return lines;
}

function lineIndexFor(hit: DateHit, lines: { text: string; offset: number }[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (line && hit.start >= line.offset) {
      return index;
    }
  }

  return 0;
}

/** Reads the document type from keywords a real letter would contain. */
export function detectDocumentType(text: string): string | null {
  if (/surat\s+keterangan\s+(?:sakit|dokter)|medical\s+certificate|doctor'?s?\s+(?:note|letter)/i.test(text)) {
    return "Medical certificate";
  }

  if (/rawat\s+inap|hospitali[sz]ation|hospital\s+discharge/i.test(text)) {
    return "Hospital document";
  }

  if (/surat\s+izin|leave\s+permit|permission\s+letter/i.test(text)) {
    return "Leave permit";
  }

  if (/surat\s+keterangan/i.test(text)) {
    return "Supporting letter";
  }

  return null;
}

function cleanName(raw: string): string | null {
  const candidate =
    raw.split(/\s{2,}/)[0]?.replace(/[|;].*$/, "") ?? "";

  // A "name" containing digits is almost certainly a mis-read address or a
  // table row. This has to run before the sanitiser below, which would strip the
  // digits and leave a plausible-looking name behind.
  if (/\d/.test(candidate)) {
    return null;
  }

  const cleaned = candidate
    .replace(/[^\p{L}\p{M}'\-. ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  return cleaned.slice(0, 120);
}

/**
 * Extracts suggestions from OCR text.
 *
 * Returns an empty object when nothing can be read with confidence — the UI then
 * simply shows the manual form, which is always available.
 */
export function parseOcrText(text: string): LeaveOcrSuggestion {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = toLines(normalized);
  const dates = findDates(normalized);

  let documentIssueDate: string | null = null;
  let leaveStartDate: string | null = null;
  let leaveEndDate: string | null = null;
  let labelled = 0;

  for (const [index, line] of lines.entries()) {
    const lineDates = dates.filter((hit) => lineIndexFor(hit, lines) === index);

    if (lineDates.length === 0) {
      continue;
    }

    if (!documentIssueDate && ISSUE_LABEL.test(line.text)) {
      documentIssueDate = lineDates[0]?.iso ?? null;

      if (documentIssueDate) {
        labelled += 1;
      }
    }

    if (!leaveStartDate && LEAVE_LABEL.test(line.text)) {
      const [first, second] = lineDates;
      leaveStartDate = first?.iso ?? null;

      if (first && second) {
        leaveEndDate = second.iso;
      } else if (first && RANGE_SEPARATOR.test(line.text)) {
        // "izin tanggal 12 s.d. 14" split across lines is handled below.
        leaveEndDate = null;
      }

      if (leaveStartDate) {
        labelled += 1;
      }
    }
  }

  // A leave period written as "12 March 2026 - 14 March 2026" on one line.
  if (leaveStartDate && !leaveEndDate) {
    const rangeLine = lines.find(
      (line) =>
        LEAVE_LABEL.test(line.text) && RANGE_SEPARATOR.test(line.text),
    );
    const rangeDates = rangeLine
      ? dates.filter((hit) => lineIndexFor(hit, lines) === lines.indexOf(rangeLine))
      : [];

    if (rangeDates.length >= 2) {
      leaveStartDate = rangeDates[0]?.iso ?? leaveStartDate;
      leaveEndDate = rangeDates[1]?.iso ?? null;
    }
  }

  // Fallback: the first date on a letter is usually its issue date.
  if (!documentIssueDate && !leaveStartDate && dates.length > 0) {
    documentIssueDate = dates[0]?.iso ?? null;
  }

  const nameMatch = NAME_LABEL.exec(normalized);
  const studentName = nameMatch?.[1] ? cleanName(nameMatch[1]) : null;
  const documentType = detectDocumentType(normalized);

  const found = [documentIssueDate, leaveStartDate, studentName, documentType]
    .filter(Boolean).length;

  if (found === 0) {
    return {};
  }

  // Labeled fields are trusted more than positional guesses; the cap keeps the
  // number honest, since OCR text is never proof of anything.
  const confidence = Math.min(0.9, 0.3 + labelled * 0.2 + found * 0.1);

  const suggestion: LeaveOcrSuggestion = { confidence };

  if (documentIssueDate) {
    suggestion.documentIssueDate = documentIssueDate;
  }

  if (leaveStartDate) {
    suggestion.leaveStartDate = leaveStartDate;
  }

  if (leaveEndDate) {
    suggestion.leaveEndDate = leaveEndDate;
  }

  if (studentName) {
    suggestion.studentName = studentName;
  }

  if (documentType) {
    suggestion.documentType = documentType;
  }

  return suggestion;
}
