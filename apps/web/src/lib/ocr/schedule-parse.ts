/**
 * Turns extracted timetable text into candidate schedule rows.
 *
 * The source documents are KHS-style tables (NO, KODE MK, NAMA MATA KULIAH,
 * DOSEN, KELAS, HARI, WAKTU, PERIODE, RUANG, TGL MULAI, TGL SELESAI) whose
 * text layer unpdf returns line by line, so one table row can span several
 * lines. Rows are therefore split by their leading row number + course
 * code, and the reliable anchors inside each chunk (day name, time range,
 * class code) locate the fields. Course name and lecturer share one
 * unseparated segment; `matchScheduleRow` resolves that split against the
 * class's subjects, keeping this parser independent of any one class.
 *
 * Like the leave parser this is conservative: anything it cannot anchor
 * becomes a warning with the raw chunk, never a guessed row.
 */

export type ParsedScheduleRow = {
  rowNumber: number;
  courseCode: string;
  /** Course name and lecturer still joined; the matcher splits them. */
  nameSegment: string;
  classCode: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  period: string | null;
  room: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type ScheduleParseWarning = {
  rowNumber: number | null;
  message: string;
  raw: string;
};

export type ScheduleParseResult = {
  rows: ParsedScheduleRow[];
  warnings: ScheduleParseWarning[];
};

const DAY_NAMES: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

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
  agu: 8,
  ags: 8,
  agt: 8,
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

const ROW_START = /^(\d{1,3})\s+([A-Za-z]*\d[A-Za-z0-9]*)\s+(.+)$/;
const TIME_RANGE = /(\d{1,2})\.(\d{2})\s*[-–—]\s*(\d{1,2})\.(\d{2})/;
const DATE_VALUE = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g;
const CLASS_CODE = /^\d{2}[A-Z]{2,}\d{3}$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(
  day: number,
  monthName: string,
  year: number,
): string | null {
  const month = MONTHS[monthName.toLowerCase()];

  if (!month || day < 1 || day > 31 || year < 1900 || year > 2999) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseChunk(
  rowNumber: number,
  courseCode: string,
  tail: string,
): { row: ParsedScheduleRow } | { warning: ScheduleParseWarning } {
  const raw = `${rowNumber} ${courseCode} ${tail}`;
  const joined = ` ${tail.replace(/\s+/g, " ")} `;

  const dayMatch = new RegExp(
    `\\b(${Object.keys(DAY_NAMES).join("|")})\\b`,
    "i",
  ).exec(joined);
  const timeMatch = TIME_RANGE.exec(joined);

  if (!dayMatch || !timeMatch) {
    return {
      warning: {
        rowNumber,
        message: "Could not find the day or time for this row; skipped.",
        raw,
      },
    };
  }

  const dayOfWeek = DAY_NAMES[dayMatch[1]?.toLowerCase() ?? ""] ?? 0;
  const startTime = `${pad(Number(timeMatch[1]))}:${timeMatch[2]}`;
  const endTime = `${pad(Number(timeMatch[3]))}:${timeMatch[4]}`;

  if (!dayOfWeek || startTime >= endTime) {
    return {
      warning: {
        rowNumber,
        message: "The day or time in this row looked invalid; skipped.",
        raw,
      },
    };
  }

  // The class code is the token right before the day name: "... 05TPLM002 Senin ...".
  const beforeDay = joined.slice(0, dayMatch.index).trim().split(" ");
  const classToken = beforeDay[beforeDay.length - 1] ?? "";
  const classCode = CLASS_CODE.test(classToken.toUpperCase())
    ? classToken.toUpperCase()
    : null;

  const nameSegment = beforeDay
    .slice(0, classCode ? beforeDay.length - 1 : undefined)
    .join(" ")
    .trim();

  if (!nameSegment) {
    return {
      warning: {
        rowNumber,
        message: "Could not find the course name in this row; skipped.",
        raw,
      },
    };
  }

  // After the time range the layout is: PERIODE RUANG TGL-MULAI TGL-SELESAI.
  const afterTime = joined
    .slice((timeMatch.index ?? 0) + timeMatch[0].length)
    .trim();
  const afterTokens = afterTime.split(" ").filter(Boolean);
  const period = /^\d{1,2}$/.test(afterTokens[0] ?? "")
    ? (afterTokens[0] ?? null)
    : null;
  const room = afterTokens[period ? 1 : 0] ?? null;

  const dates = [...afterTime.matchAll(DATE_VALUE)].map((match) =>
    toIsoDate(Number(match[1]), match[2] ?? "", Number(match[3])),
  );
  const startDate = dates[0] ?? null;
  const endDate = dates[1] ?? null;

  return {
    row: {
      rowNumber,
      courseCode,
      nameSegment,
      classCode,
      dayOfWeek,
      startTime,
      endTime,
      period,
      room,
      startDate,
      endDate,
    },
  };
}

export function parseScheduleText(text: string): ScheduleParseResult {
  const rows: ParsedScheduleRow[] = [];
  const warnings: ScheduleParseWarning[] = [];
  let current: {
    rowNumber: number;
    courseCode: string;
    lines: string[];
  } | null = null;

  const flush = () => {
    if (!current) {
      return;
    }

    const parsed = parseChunk(
      current.rowNumber,
      current.courseCode,
      current.lines.join(" "),
    );

    if ("row" in parsed) {
      rows.push(parsed.row);
    } else {
      warnings.push(parsed.warning);
    }
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = ROW_START.exec(trimmed);

    // A new row starts only when the code looks like a course code (has a
    // digit) and the running chunk already has its time anchor; otherwise
    // the line is a wrapped continuation of the current row.
    if (
      match &&
      /\d/.test(match[2] ?? "") &&
      (!current || TIME_RANGE.test(current.lines.join(" ")))
    ) {
      flush();
      current = {
        rowNumber: Number(match[1]),
        courseCode: (match[2] ?? "").toUpperCase(),
        lines: [match[3] ?? ""],
      };
    } else if (current) {
      current.lines.push(trimmed);
    }
  }

  flush();

  return { rows, warnings };
}
