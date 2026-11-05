/**
 * Parses a printed attendance sheet (text layer) into present flags.
 *
 * Expects one student per line (NIM + name + tick marks). Presence is
 * detected by common tick characters (✓ √ ✔ v x ✓) or a standalone
 * "1" / "hadir" token on the same line as the NIM. Matching is by NIM
 * (studentCode) against the roster, never by position alone.
 */

export type AttendanceSheetHit = {
  studentCode: string;
  present: boolean;
  line: string;
};

const TICK_PATTERN = /[✓√✔vVxX✓]/;
const PRESENT_WORD = /\b(hadir|present|1)\b/i;

export function parseAttendanceSheetText(
  text: string,
  rosterCodes: string[],
): AttendanceSheetHit[] {
  const wanted = new Set(
    rosterCodes.map((code) => code.trim()).filter(Boolean),
  );
  const hits: AttendanceSheetHit[] = [];

  if (wanted.size === 0) {
    return hits;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    for (const code of wanted) {
      if (!trimmed.includes(code)) {
        continue;
      }

      hits.push({
        studentCode: code,
        present: TICK_PATTERN.test(trimmed) || PRESENT_WORD.test(trimmed),
        line,
      });
    }
  }

  return hits;
}
