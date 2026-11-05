/**
 * Timezone-aware display helpers for the schedule readers.
 *
 * Pure functions so the formatting rules are unit-testable without a database.
 * `Intl.DateTimeFormat` is used throughout; no date math is done by hand.
 */

const FALLBACK_TIMEZONE = "UTC";

/** Falls back to UTC when the stored timezone is missing or invalid. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return FALLBACK_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return timeZone;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/** `2026-11-10 09:30 (Asia/Jakarta)` — stable, locale-independent output. */
export function formatInTimeZone(
  iso: string,
  timeZone: string | null | undefined,
): string {
  const resolved = resolveTimeZone(timeZone);
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: resolved,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return `${formatted} (${resolved})`;
}

/** ISO weekday names (1 = Monday … 7 = Sunday), matching `schedule_rules`. */
export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? `Day ${weekday}`;
}

/** `HH:MM` window for a rule, independent of viewer timezone. */
export function formatTimeWindow(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
}
