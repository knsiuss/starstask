const UNSAFE_FILENAME_PATTERN = /[^A-Za-z0-9]+/g;

type AttendanceFilenameParts = {
  classCode: string | null;
  className: string;
  subjectCode: string | null;
  subjectName: string;
};

/** Uppercase token safe for `Content-Disposition` and every filesystem. */
function toToken(value: string | null | undefined, fallback: string): string {
  const token = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(UNSAFE_FILENAME_PATTERN, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .toUpperCase();

  return token || fallback;
}

function classToken(parts: AttendanceFilenameParts): string {
  return toToken(parts.classCode, toToken(parts.className, "CLASS"));
}

function subjectToken(parts: AttendanceFilenameParts): string {
  return toToken(parts.subjectCode, toToken(parts.subjectName, "SUBJECT"));
}

export function buildMeetingFilename(
  parts: AttendanceFilenameParts & { meetingNumber: number },
): string {
  const meeting = String(parts.meetingNumber).padStart(2, "0");

  return `${classToken(parts)}_${subjectToken(parts)}_Pertemuan_${meeting}.xlsx`;
}

export function buildRecapFilename(
  parts: AttendanceFilenameParts & { year: number },
): string {
  return `${classToken(parts)}_${subjectToken(parts)}_Attendance_Recap_${parts.year}.xlsx`;
}

export function buildChecklistFilename(parts: AttendanceFilenameParts): string {
  return `${classToken(parts)}_${subjectToken(parts)}_Attendance_Checklist.xlsx`;
}

/**
 * Recap filename year = tahun kalender saat export (owner: tahun ajaran
 * sekarang, bukan end year dari academic_year kelas).
 * academicYear param kept for API compat, diabaikan.
 */
export function resolveRecapYear(
  academicYear: string,
  now: Date = new Date(),
): number {
  void academicYear;
  return now.getFullYear();
}
