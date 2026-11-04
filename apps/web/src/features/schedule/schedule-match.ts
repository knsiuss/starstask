import type { ParsedScheduleRow } from "@/lib/ocr/schedule-parse";

/** The subject fields matching needs; the full view satisfies this. */
export type MatchableSubject = {
  id: string;
  name: string;
  code: string | null;
  lecturer_name: string | null;
};

export type ScheduleMatchMethod = "code" | "name" | "name+lecturer" | "none";

export type MatchedScheduleRow = ParsedScheduleRow & {
  subjectId: string | null;
  /** Course name and lecturer after splitting the raw segment. */
  courseName: string;
  lecturerName: string | null;
  matchedBy: ScheduleMatchMethod;
  warnings: string[];
};

const ROMAN_NUMERALS: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
};

/** Lowercase, drop punctuation, and equate roman numerals with digits. */
export function normalizeScheduleName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ROMAN_NUMERALS[token] ?? token)
    .join(" ");
}

function tokens(value: string): string[] {
  return normalizeScheduleName(value).split(" ").filter(Boolean);
}

/**
 * Splits the joined name+lecturer segment against one subject: the subject
 * name must be a prefix of the segment, and the remainder is the lecturer.
 */
function splitAgainst(
  segment: string,
  subjectName: string,
): { courseName: string; lecturerName: string | null } | null {
  const segmentTokens = tokens(segment);
  const nameTokens = tokens(subjectName);

  if (
    nameTokens.length === 0 ||
    nameTokens.length > segmentTokens.length ||
    nameTokens.some((token, index) => token !== segmentTokens[index])
  ) {
    return null;
  }

  const rest = segmentTokens.slice(nameTokens.length).join(" ");

  return {
    courseName: subjectName,
    lecturerName: rest ? toTitleCase(rest) : null,
  };
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) =>
      word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word,
    )
    .join(" ");
}

/**
 * Matches one parsed row to a subject of the class, in layers: course
 * code, then name prefix (with the remainder becoming the lecturer), then
 * lecturer as a tie-break between close names. No match means the caller
 * must ask the user; this function never guesses.
 */
export function matchScheduleRow(
  row: ParsedScheduleRow,
  subjects: readonly MatchableSubject[],
): MatchedScheduleRow {
  const normalizedCode = row.courseCode.trim().toUpperCase();
  const byCode = subjects.find(
    (subject) => subject.code?.trim().toUpperCase() === normalizedCode,
  );

  if (byCode) {
    const split = splitAgainst(row.nameSegment, byCode.name);

    return {
      ...row,
      subjectId: byCode.id,
      courseName: byCode.name,
      lecturerName: split?.lecturerName ?? null,
      matchedBy: "code",
      warnings: split
        ? []
        : ["Course matched by code; the lecturer could not be separated."],
    };
  }

  const candidates = subjects
    .map((subject) => ({
      subject,
      split: splitAgainst(row.nameSegment, subject.name),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        subject: MatchableSubject;
        split: NonNullable<ReturnType<typeof splitAgainst>>;
      } => candidate.split !== null,
    );

  if (candidates.length > 0) {
    // The longest name wins (most specific); the lecturer named in the
    // segment breaks a tie between equally long candidates.
    const ranked = [...candidates].sort(
      (first, second) =>
        tokens(second.subject.name).length - tokens(first.subject.name).length,
    );
    const topLength = tokens(ranked[0]?.subject.name ?? "").length;
    const top = ranked.filter(
      (candidate) => tokens(candidate.subject.name).length === topLength,
    );
    const segment = normalizeScheduleName(row.nameSegment);
    const lecturerHit = top.find(
      (candidate) =>
        candidate.subject.lecturer_name &&
        segment.includes(
          normalizeScheduleName(candidate.subject.lecturer_name),
        ),
    );
    const chosen = lecturerHit ?? top[0];

    if (chosen) {
      return {
        ...row,
        subjectId: chosen.subject.id,
        courseName: chosen.split.courseName,
        lecturerName: chosen.split.lecturerName,
        matchedBy: lecturerHit ? "name+lecturer" : "name",
        warnings:
          top.length > 1 && !lecturerHit
            ? ["More than one course name fits; check the match."]
            : [],
      };
    }
  }

  return {
    ...row,
    subjectId: null,
    courseName: toTitleCase(row.nameSegment),
    lecturerName: null,
    matchedBy: "none",
    warnings: [
      "No course in this class matches this row; choose one manually.",
    ],
  };
}
