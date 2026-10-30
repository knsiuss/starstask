/**
 * Shared calendar helpers.
 *
 * Calendar keys are plain `YYYY-MM-DD` strings in Asia/Jakarta. The zone has
 * no daylight saving, so day arithmetic on those keys is deterministic and
 * wall-clock weekly slots always map to the same offset.
 */

import {
  APP_TIME_ZONE,
  APP_TIME_ZONE_OFFSET,
  toJakartaDateKey,
} from "./deadline";

export const CALENDAR_VIEW_KINDS = ["month", "week", "day", "agenda"] as const;

export type CalendarViewKind = (typeof CALENDAR_VIEW_KINDS)[number];

export const AGENDA_WINDOW_DAYS = 30;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAY_MS = 24 * 60 * 60 * 1_000;

export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

function formatDateKey(parts: CalendarDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Parses a key and rejects impossible dates such as 2026-02-31. */
export function parseCalendarDateKey(value: string): CalendarDateParts | null {
  const match = DATE_KEY_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isCalendarDateKey(value: string): boolean {
  return parseCalendarDateKey(value) !== null;
}

/** Today's date key in Asia/Jakarta, not the server's local zone. */
export function todayDateKey(now: Date = new Date()): string {
  return toJakartaDateKey(now);
}

export function dateKeyToDate(value: string): Date {
  const parts = parseCalendarDateKey(value);

  if (!parts) {
    throw new RangeError("Invalid calendar date key");
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function addDaysToDateKey(value: string, delta: number): string {
  const date = dateKeyToDate(value);
  date.setUTCDate(date.getUTCDate() + delta);

  return date.toISOString().slice(0, 10);
}

/** ISO weekday: 1 = Monday .. 7 = Sunday. */
export function dateKeyWeekday(value: string): number {
  const weekday = dateKeyToDate(value).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

/** Monday of the week that contains `value`. */
export function startOfWeekDateKey(value: string): string {
  return addDaysToDateKey(value, -(dateKeyWeekday(value) - 1));
}

function addMonthsToDateKey(value: string, delta: number): string {
  const parts = parseCalendarDateKey(value);

  if (!parts) {
    throw new RangeError("Invalid calendar date key");
  }

  const zeroBased = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(zeroBased / 12);
  const month = zeroBased - year * 12 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return formatDateKey({ year, month, day: Math.min(parts.day, lastDay) });
}

export type CalendarDayCell = {
  dateKey: string;
  dayOfMonth: number;
  /** False for the padding days a month grid borrows from adjacent months. */
  inMonth: boolean;
};

export type CalendarRange = {
  view: CalendarViewKind;
  anchorKey: string;
  startKey: string;
  endKey: string;
  /** Half-open instant window for database queries. */
  fromIso: string;
  toIso: string;
  days: CalendarDayCell[];
};

function buildDays(
  startKey: string,
  count: number,
  anchorMonth: number | null,
): CalendarDayCell[] {
  const days: CalendarDayCell[] = [];

  for (let index = 0; index < count; index += 1) {
    const dateKey = addDaysToDateKey(startKey, index);
    const parts = parseCalendarDateKey(dateKey);

    if (!parts) {
      continue;
    }

    days.push({
      dateKey,
      dayOfMonth: parts.day,
      inMonth: anchorMonth === null || parts.month === anchorMonth,
    });
  }

  return days;
}

/**
 * Builds the visible day cells and the query window for one view.
 *
 * A month grid always renders six weeks, so a month that starts on Sunday
 * still has the same height as the others.
 */
export function buildCalendarViewRange(
  view: CalendarViewKind,
  anchorKey: string,
): CalendarRange {
  const anchor = parseCalendarDateKey(anchorKey);

  if (!anchor) {
    throw new RangeError("Invalid calendar anchor date");
  }

  let startKey: string;
  let dayCount: number;
  let anchorMonth: number | null = null;

  if (view === "month") {
    const firstOfMonth = formatDateKey({
      year: anchor.year,
      month: anchor.month,
      day: 1,
    });
    startKey = startOfWeekDateKey(firstOfMonth);
    dayCount = 42;
    anchorMonth = anchor.month;
  } else if (view === "week") {
    startKey = startOfWeekDateKey(anchorKey);
    dayCount = 7;
  } else if (view === "day") {
    startKey = anchorKey;
    dayCount = 1;
  } else {
    startKey = anchorKey;
    dayCount = AGENDA_WINDOW_DAYS;
  }

  const endKey = addDaysToDateKey(startKey, dayCount - 1);
  const dayAfterEnd = addDaysToDateKey(endKey, 1);

  return {
    view,
    anchorKey,
    startKey,
    endKey,
    fromIso: `${startKey}T00:00:00${APP_TIME_ZONE_OFFSET}`,
    toIso: `${dayAfterEnd}T00:00:00${APP_TIME_ZONE_OFFSET}`,
    days: buildDays(startKey, dayCount, anchorMonth),
  };
}

/** Moves the anchor by one page: a month, a week, a day, or an agenda window. */
export function shiftCalendarAnchor(
  view: CalendarViewKind,
  anchorKey: string,
  delta: number,
): string {
  if (view === "month") {
    return addMonthsToDateKey(anchorKey, delta);
  }

  if (view === "week") {
    return addDaysToDateKey(anchorKey, 7 * delta);
  }

  if (view === "day") {
    return addDaysToDateKey(anchorKey, delta);
  }

  return addDaysToDateKey(anchorKey, AGENDA_WINDOW_DAYS * delta);
}

const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const shortDayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** `Thu, 29 Oct 2026`. */
export function formatCalendarDayLabel(dateKey: string): string {
  return dayLabelFormatter.format(dateKeyToDate(dateKey));
}

/** `Thu 29`, for a week column header. */
export function formatCalendarShortDay(dateKey: string): string {
  return shortDayFormatter.format(dateKeyToDate(dateKey));
}

/** `October 2026`. */
export function formatCalendarMonthLabel(dateKey: string): string {
  const parts = parseCalendarDateKey(dateKey);

  if (!parts) {
    return "Invalid date";
  }

  return monthFormatter.format(
    new Date(Date.UTC(parts.year, parts.month - 1, 1)),
  );
}

/** `19:00` in Asia/Jakarta. */
export function formatCalendarTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Invalid time"
    : timeFormatter.format(date);
}

/** `Thu, 29 Oct 2026`. */
export function formatCalendarInstantDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : dateTimeFormatter.format(date);
}

/** The Asia/Jakarta date key an instant belongs to. */
export function calendarEventDateKey(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : toJakartaDateKey(date);
}

export type WeeklySlot = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type WeeklyOccurrence<T extends WeeklySlot> = {
  entry: T;
  dateKey: string;
  startsAt: string;
  endsAt: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d/;

/**
 * Expands recurring weekly slots into dated occurrences for the visible days.
 *
 * Times are class-local wall clock in Asia/Jakarta. Indonesia has no daylight
 * saving, so a fixed offset is exact and keeps the expansion server-renderable.
 */
export function expandWeeklyScheduleForDays<T extends WeeklySlot>(
  entries: T[],
  days: string[],
): WeeklyOccurrence<T>[] {
  const occurrences: WeeklyOccurrence<T>[] = [];

  for (const day of days) {
    const weekday = dateKeyWeekday(day);

    for (const entry of entries) {
      if (entry.day_of_week !== weekday) {
        continue;
      }

      const start = entry.start_time.slice(0, 5);
      const end = entry.end_time.slice(0, 5);

      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        continue;
      }

      occurrences.push({
        entry,
        dateKey: day,
        startsAt: `${day}T${start}:00${APP_TIME_ZONE_OFFSET}`,
        endsAt: `${day}T${end}:00${APP_TIME_ZONE_OFFSET}`,
      });
    }
  }

  return occurrences;
}
