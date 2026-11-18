export type TimeSlotCandidate = {
  id?: string;
  classId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  lecturerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();

  return trimmed.length > 0 ? trimmed : null;
}

function datesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null,
): boolean {
  if (aStart && bEnd && aStart > bEnd) {
    return false;
  }

  if (aEnd && bStart && aEnd < bStart) {
    return false;
  }

  return true;
}

/**
 * Standard half-open interval overlap check: `start < existingEnd && end > existingStart`.
 * Adjacent slots such as `08:00-10:00` and `10:00-12:00` do not overlap.
 */
export function hasTimeSlotOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Checks whether two weekly schedule slots collide on the same day of week
 * for the same class, room, or lecturer.
 */
export function hasTimeSlotCollision(
  a: TimeSlotCandidate,
  b: TimeSlotCandidate,
): boolean {
  if (a.id && b.id && a.id === b.id) {
    return false;
  }

  if (a.dayOfWeek !== b.dayOfWeek) {
    return false;
  }

  if (!datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
    return false;
  }

  const sameClass =
    a.classId === undefined ||
    b.classId === undefined ||
    a.classId === b.classId;
  const roomA = normalizeOptionalText(a.room);
  const roomB = normalizeOptionalText(b.room);
  const sameRoom = roomA !== null && roomB !== null && roomA === roomB;
  const lecturerA = normalizeOptionalText(a.lecturerName);
  const lecturerB = normalizeOptionalText(b.lecturerName);
  const sameLecturer =
    lecturerA !== null && lecturerB !== null && lecturerA === lecturerB;

  if (!sameClass && !sameRoom && !sameLecturer) {
    return false;
  }

  return hasTimeSlotOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
}

/** Returns all existing slots that collide with `candidate`. */
export function findScheduleCollisions<T extends TimeSlotCandidate>(
  candidate: TimeSlotCandidate,
  existing: readonly T[],
): T[] {
  return existing.filter((slot) => hasTimeSlotCollision(candidate, slot));
}

export function formatScheduleCollisionMessage(
  conflict: Pick<TimeSlotCandidate, "startTime" | "endTime">,
): string {
  return `This time slot overlaps with an existing slot (${conflict.startTime.slice(0, 5)} - ${conflict.endTime.slice(0, 5)}).`;
}
