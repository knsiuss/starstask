/**
 * Lifecycle predicates for the calendar, in pure date-key comparisons.
 *
 * The rule (spec §3): expired items — a past-due assignment the user has
 * not completed, or an event that already ended — stay out of the default
 * calendar so it only shows relevant upcoming work. They are never
 * deleted or auto-completed; the Past Events toggle reveals them.
 * Completed assignments keep their existing visible state in both
 * modes (completion semantics are unchanged).
 */

type Expirable = {
  /** YYYY-MM-DD, inclusive last day. */
  endKey: string;
};

type AssignmentLike = Expirable & {
  isCompleted: boolean;
};

/** True when the item's last day is before today (Jakarta date keys). */
export function isExpiredItem(item: Expirable, todayKey: string): boolean {
  return item.endKey < todayKey;
}

/** Assignments hide only when past due and not completed by the user. */
export function isAssignmentHiddenFromDefault(
  assignment: AssignmentLike,
  todayKey: string,
): boolean {
  return !assignment.isCompleted && isExpiredItem(assignment, todayKey);
}

/** Events hide once they have ended. */
export function isEventHiddenFromDefault(
  event: Expirable,
  todayKey: string,
): boolean {
  return isExpiredItem(event, todayKey);
}

/**
 * Applies the default-view lifecycle filter unless history is shown.
 * Returns the same array (not a copy) when history is on.
 */
export function filterForCalendarView<T extends Expirable>(
  items: readonly T[],
  todayKey: string,
  showHistory: boolean,
): T[] {
  if (showHistory) {
    return [...items];
  }

  return items.filter((item) => !isExpiredItem(item, todayKey));
}
