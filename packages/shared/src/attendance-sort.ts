/**
 * Alphabetical roster ordering used by every attendance surface.
 *
 * Indonesian names are compared case-insensitively with the `id` collator, so
 * "Ahmad" and "ahmad" are adjacent and accented letters sort naturally. The NIM
 * is the tie-breaker and is compared numerically, so 101 comes before 1002.
 */
const nameCollator = new Intl.Collator("id", {
  sensitivity: "base",
  numeric: true,
});

export type AttendanceRosterSortKey = {
  fullName: string;
  nim: string | null;
};

function normalizeNim(nim: string | null): string | null {
  if (!nim) {
    return null;
  }

  const trimmed = nim.trim();

  return trimmed === "" ? null : trimmed;
}

export function compareAttendanceRosterEntries(
  left: AttendanceRosterSortKey,
  right: AttendanceRosterSortKey,
): number {
  const byName = nameCollator.compare(
    left.fullName.trim(),
    right.fullName.trim(),
  );

  if (byName !== 0) {
    return byName;
  }

  const leftNim = normalizeNim(left.nim);
  const rightNim = normalizeNim(right.nim);

  // A missing NIM goes last so a partially filled profile never jumps ahead of
  // a student whose NIM is known.
  if (leftNim === null && rightNim === null) {
    return 0;
  }

  if (leftNim === null) {
    return 1;
  }

  if (rightNim === null) {
    return -1;
  }

  return nameCollator.compare(leftNim, rightNim);
}

export function sortAttendanceRoster<T extends AttendanceRosterSortKey>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(compareAttendanceRosterEntries);
}
