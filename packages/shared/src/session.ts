/**
 * Discussion session helpers.
 *
 * Every function is pure and takes the session's own IANA zone, so a session
 * created for Asia/Jakarta is displayed in that zone regardless of where the
 * reader is. Instants stay absolute; only the presentation changes.
 */

import { APP_TIME_ZONE, APP_TIME_ZONE_LABEL } from "./deadline";

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(
  timeZone: string,
  withWeekday: boolean,
): Intl.DateTimeFormat {
  const key = `${timeZone}:${withWeekday ? "weekday" : "plain"}`;
  const cached = dateTimeFormatterCache.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: withWeekday ? "short" : undefined,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  dateTimeFormatterCache.set(key, formatter);

  return formatter;
}

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function timeFormatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = timeFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  timeFormatterCache.set(timeZone, formatter);

  return formatter;
}

/** True when the runtime's Intl implementation knows this zone. */
export function isKnownTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}

/** Falls back to Asia/Jakarta instead of throwing inside a render. */
export function resolveTimeZone(value: string | null | undefined): string {
  return value && isKnownTimeZone(value) ? value : APP_TIME_ZONE;
}

/** Short zone label: `WIB` for Jakarta, the IANA name otherwise. */
export function timeZoneLabel(timeZone: string): string {
  const zone = resolveTimeZone(timeZone);

  return zone === APP_TIME_ZONE ? APP_TIME_ZONE_LABEL : zone;
}

function parse(value: string): Date | null {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** `29 Oct 2026` in the session zone. */
export function formatSessionDate(
  value: string,
  timeZone: string,
  options: { withWeekday?: boolean } = {},
): string {
  const date = parse(value);

  if (!date) {
    return "Invalid date";
  }

  return formatterFor(
    resolveTimeZone(timeZone),
    options.withWeekday ?? false,
  ).format(date);
}

/** `19:00` in the session zone. */
export function formatSessionTime(value: string, timeZone: string): string {
  const date = parse(value);

  if (!date) {
    return "Invalid time";
  }

  return timeFormatterFor(resolveTimeZone(timeZone)).format(date);
}

/**
 * `Thu, 29 Oct 2026, 19:00–21:00 WIB`.
 *
 * When the session ends on another day the end date is included, so a
 * midnight-crossing session cannot read as a two-hour meeting on one day.
 */
export function formatSessionRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): string {
  const start = parse(startsAt);
  const end = parse(endsAt);

  if (!start || !end) {
    return "Invalid date";
  }

  const zone = resolveTimeZone(timeZone);
  const startLabel = `${formatSessionDate(startsAt, zone, { withWeekday: true })}, ${formatSessionTime(startsAt, zone)}`;
  const endLabel =
    toDateKey(startsAt, zone) === toDateKey(endsAt, zone)
      ? formatSessionTime(endsAt, zone)
      : `${formatSessionDate(endsAt, zone, { withWeekday: true })}, ${formatSessionTime(endsAt, zone)}`;

  return `${startLabel}–${endLabel} ${timeZoneLabel(zone)}`;
}

/** `YYYY-MM-DD` for an instant in a specific zone. */
export function toDateKey(value: string, timeZone: string): string {
  const date = parse(value);

  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`;
}

export function sessionDurationMinutes(
  startsAt: string,
  endsAt: string,
): number {
  const start = parse(startsAt);
  const end = parse(endsAt);

  if (!start || !end || end <= start) {
    return 0;
  }

  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export type CalendarDay = {
  dateKey: string;
  dayOfMonth: number;
  inMonth: boolean;
};

/**
 * Builds a Monday-first six-week grid for a month.
 *
 * Dates are computed in UTC so the grid never shifts on a DST boundary; the
 * keys are plain `YYYY-MM-DD` strings compared against `toDateKey`.
 */
export function buildCalendarMonth(
  year: number,
  month: number,
): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const weekday = first.getUTCDay();
  const leadingDays = (weekday + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - leadingDays);

  const weeks: CalendarDay[][] = [];

  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];

    for (let day = 0; day < 7; day += 1) {
      const current = new Date(gridStart);
      current.setUTCDate(gridStart.getUTCDate() + week * 7 + day);

      days.push({
        dateKey: current.toISOString().slice(0, 10),
        dayOfMonth: current.getUTCDate(),
        inMonth: current.getUTCMonth() === month - 1,
      });
    }

    weeks.push(days);
  }

  return weeks;
}

/** Month arithmetic that stays inside 1–12. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = zeroBased - nextYear * 12 + 1;

  return { year: nextYear, month: nextMonth };
}

export function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Query window for one calendar month, padded by a day on each side.
 *
 * The grid groups sessions by their local date, so a session at 00:30 in
 * Asia/Tokyo on the 1st starts on the last UTC day of the previous month. The
 * padding keeps that session inside the month it is drawn in.
 */
export function sessionMonthWindow(
  year: number,
  month: number,
): { from: string; to: string } {
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 1);

  return {
    from: new Date(start - DAY_MS).toISOString(),
    to: new Date(end + DAY_MS).toISOString(),
  };
}

/** Offset of `timeZone` at a given instant, in milliseconds. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") % 24,
    read("minute"),
    read("second"),
  );

  return asUtc - utcMs;
}

/** Converts an instant into a `YYYY-MM-DDTHH:mm` value in `timeZone`. */
export function isoToZonedDateTimeInput(
  value: string,
  timeZone: string,
): string {
  const date = parse(value);

  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}

/**
 * Interprets a `datetime-local` value as wall-clock time in `timeZone` and
 * returns the matching UTC instant.
 *
 * The offset is looked up twice because a wall-clock value near a DST boundary
 * can resolve to a different offset than the naive instant suggests. A value
 * that does not round-trip (for example 31 February, or a time skipped by a DST
 * jump) returns `null` instead of silently rolling over.
 */
export function zonedDateTimeInputToIso(
  value: string,
  timeZone: string,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;

  if (!year || !month || !day || !hour || !minute) {
    return null;
  }

  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  if (!Number.isFinite(naive)) {
    return null;
  }

  const zone = resolveTimeZone(timeZone);
  const firstOffset = zoneOffsetMs(naive, zone);
  let candidate = naive - firstOffset;
  const secondOffset = zoneOffsetMs(candidate, zone);

  if (secondOffset !== firstOffset) {
    candidate = naive - secondOffset;
  }

  const iso = new Date(candidate).toISOString();

  return isoToZonedDateTimeInput(iso, zone) === value.trim() ? iso : null;
}
