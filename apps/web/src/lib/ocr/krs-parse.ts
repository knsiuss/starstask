import {
  KRS_COURSES_MAX,
  KRS_COURSE_CODE_MAX,
  KRS_COURSE_NAME_MAX,
  KRS_LECTURER_NAME_MAX,
  KRS_ROOM_MAX,
  type KrsCourseDraft,
  type KrsParseResponse,
} from "@starstask/contracts";

import { parseScheduleText, type ParsedScheduleRow } from "./schedule-parse";

const PII_LINE_PATTERN =
  /^\s*(?:nama\s*(?:mahasiswa|mhs)?|nim|npm|nrp|ipk|ips|tempat\s*lahir|tanggal\s*lahir|ttl|alamat|no\.?\s*(?:hp|telp|telepon)|telepon|email)\b/i;

const ACADEMIC_YEAR_SLASH = /\b(20\d{2})\s*\/\s*(20\d{2})\b/;
const ACADEMIC_YEAR_HYPHEN =
  /(?:tahun\s*(?:akademik|ajaran)|t\.?a\.?|semester(?:\s+(?:ganjil|genap|pendek))?)[^0-9\r\n]{0,20}(20\d{2})\s*[-–]\s*(20\d{2})\b/i;

const EXPLICIT_SEMESTER = /\b(?:semester|smt)\s*[:.]?\s*0?(\d{1,2})\b/i;

const EXPLICIT_CLASS_CODE =
  /\b(?:kelas|class)\s*[:.]?\s*([A-Za-z0-9]{2,20})\b/i;

const CLASS_CODE_WITH_SEMESTER = /^(\d{2})([A-Z]{2,}\d{2,})$/;

const FALLBACK_NUMBERED_ROW =
  /^\s*\d{1,3}[.)]?\s+([A-Za-z]*\d[A-Za-z0-9-]{1,29})\s+(.+)$/;

const FALLBACK_CODED_ROW =
  /^\s*([A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]{0,20})\s*[-|:]\s*(.+)$/;

function stripPiiLines(rawText: string): string {
  return rawText
    .split(/\r?\n/)
    .filter((line) => !PII_LINE_PATTERN.test(line))
    .join("\n");
}

function clampText(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > max ? normalized.slice(0, max).trim() : normalized;
}

function extractAcademicYear(text: string): string | null {
  for (const pattern of [ACADEMIC_YEAR_SLASH, ACADEMIC_YEAR_HYPHEN]) {
    const match = pattern.exec(text);

    if (!match) {
      continue;
    }

    const start = Number(match[1]);
    const end = Number(match[2]);

    if (end === start + 1) {
      return `${start}/${end}`;
    }
  }

  return null;
}

function parseValidSemester(raw: string | undefined): number | null {
  const parsed = Number.parseInt(raw ?? "", 10);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 14
    ? parsed
    : null;
}

function extractSemesterNumber(
  text: string,
  classCode: string | null,
): number | null {
  const explicitMatch = EXPLICIT_SEMESTER.exec(text);
  const explicit = explicitMatch ? parseValidSemester(explicitMatch[1]) : null;

  if (explicit !== null) {
    return explicit;
  }

  const prefixMatch = classCode
    ? CLASS_CODE_WITH_SEMESTER.exec(classCode)
    : null;

  return prefixMatch ? parseValidSemester(prefixMatch[1]) : null;
}

function normalizeClassCode(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return cleaned.length >= 2 && cleaned.length <= 20 ? cleaned : null;
}

function extractClassCode(
  text: string,
  rows: ParsedScheduleRow[],
): string | null {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const normalized = normalizeClassCode(row.classCode);

    if (normalized) {
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  if (counts.size > 0) {
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  const headerMatch = EXPLICIT_CLASS_CODE.exec(text);
  const candidate = headerMatch ? normalizeClassCode(headerMatch[1]) : null;

  // Avoid mistaking table headers like "KELAS HARI WAKTU" for a class code.
  return candidate && /\d/.test(candidate) ? candidate : null;
}

function splitNameAndLecturer(segment: string): {
  courseName: string;
  lecturerName: string | null;
} {
  const parts = segment
    .split(/\s*[|\t]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      courseName: clampText(parts[0] ?? "", KRS_COURSE_NAME_MAX),
      lecturerName: clampText(parts[1] ?? "", KRS_LECTURER_NAME_MAX),
    };
  }

  return {
    courseName: clampText(segment, KRS_COURSE_NAME_MAX),
    lecturerName: null,
  };
}

function mapScheduleRow(row: ParsedScheduleRow): KrsCourseDraft | null {
  const courseCode = clampText(
    row.courseCode.toUpperCase(),
    KRS_COURSE_CODE_MAX,
  );
  const { courseName, lecturerName } = splitNameAndLecturer(row.nameSegment);

  if (!courseCode || courseName.length < 2) {
    return null;
  }

  return {
    courseCode,
    courseName,
    lecturerName,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    room: row.room ? clampText(row.room, KRS_ROOM_MAX) : null,
  };
}

function parseFallbackCourses(text: string): KrsCourseDraft[] {
  const courses: KrsCourseDraft[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed
      ? (FALLBACK_NUMBERED_ROW.exec(trimmed) ??
        FALLBACK_CODED_ROW.exec(trimmed))
      : null;
    const rawCode = (match?.[1] ?? "").toUpperCase();

    if (!match || !/\d/.test(rawCode)) {
      continue;
    }

    const cleanedTail = (match[2] ?? "")
      .replace(/\s*\|\s*/g, " | ")
      .replace(/\(\s*\d+\s*SKS\s*\)/gi, "")
      .replace(/\b\d+\s*SKS\b/gi, "")
      .replace(/\s+\d{1,2}\s*$/, "")
      .trim();
    const { courseName, lecturerName } = splitNameAndLecturer(cleanedTail);

    if (courseName.length >= 2) {
      courses.push({
        courseCode: clampText(rawCode, KRS_COURSE_CODE_MAX),
        courseName,
        lecturerName,
        dayOfWeek: null,
        startTime: null,
        endTime: null,
        room: null,
      });
    }
  }

  return courses;
}

function deduplicateCourses(courses: KrsCourseDraft[]): KrsCourseDraft[] {
  const seen = new Set<string>();

  return courses.filter((course) => {
    const key = `${course.courseCode.toUpperCase()}|${course.dayOfWeek ?? ""}|${course.startTime ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

/**
 * Extracts class identity, courses, and weekly schedule slots from KRS or
 * KHS timetable text while discarding personal student identifiers (NIM, IPK,
 * and student names).
 */
export function parseKrsText(rawText: string): KrsParseResponse {
  if (!rawText.trim()) {
    return {
      classCode: null,
      semesterNumber: null,
      academicYear: null,
      courses: [],
      warnings: [],
    };
  }

  const sanitizedText = stripPiiLines(rawText);
  const scheduleResult = parseScheduleText(sanitizedText);
  const warnings: string[] = [];

  let courses = scheduleResult.rows
    .map(mapScheduleRow)
    .filter((course): course is KrsCourseDraft => course !== null);

  if (courses.length === 0) {
    courses = parseFallbackCourses(sanitizedText);

    if (courses.length > 0 && scheduleResult.warnings.length > 0) {
      warnings.push(
        "No weekly day/time schedule found; imported course list only.",
      );
    }
  } else {
    for (const warning of scheduleResult.warnings) {
      const prefix = warning.rowNumber ? `Row ${warning.rowNumber}: ` : "";

      warnings.push(`${prefix}${warning.message}`);
    }
  }

  courses = deduplicateCourses(courses);

  if (courses.length > KRS_COURSES_MAX) {
    warnings.push(
      `Only the first ${KRS_COURSES_MAX} courses were kept (maximum per import).`,
    );
    courses = courses.slice(0, KRS_COURSES_MAX);
  }

  const classCode = extractClassCode(sanitizedText, scheduleResult.rows);
  const academicYear = extractAcademicYear(sanitizedText);
  const semesterNumber = extractSemesterNumber(sanitizedText, classCode);

  if (courses.length === 0) {
    warnings.push("No courses could be extracted from the KRS text.");
  }

  return {
    classCode,
    semesterNumber,
    academicYear,
    courses,
    warnings,
  };
}
