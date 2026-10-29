/**
 * Deadline helpers. Every date is rendered and compared in Asia/Jakarta
 * (WIB, UTC+7), which has no daylight saving transitions, so a fixed offset is
 * safe and keeps conversions deterministic across server and browser.
 */

export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_TIME_ZONE_OFFSET = "+07:00";
export const APP_TIME_ZONE_LABEL = "WIB";

export type DeadlineState = "none" | "upcoming" | "due_today" | "overdue";

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const deadlineFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Returns `YYYY-MM-DD` for the given instant in Asia/Jakarta. */
export function toJakartaDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date passed to toJakartaDateKey");
  }

  return jakartaDateFormatter.format(date);
}

/**
 * Classifies a deadline. `due_today` wins over `overdue` so a deadline that
 * passed earlier today still reads as actionable rather than late.
 */
export function getDeadlineState(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): DeadlineState {
  if (!deadline) {
    return "none";
  }

  const deadlineDate =
    typeof deadline === "string" ? new Date(deadline) : deadline;

  if (Number.isNaN(deadlineDate.getTime())) {
    return "none";
  }

  if (toJakartaDateKey(deadlineDate) === toJakartaDateKey(now)) {
    return "due_today";
  }

  return deadlineDate.getTime() < now.getTime() ? "overdue" : "upcoming";
}

/** Formats a deadline as `29 Oct 2026, 23:59 WIB`. */
export function formatDeadline(deadline: Date | string): string {
  const date = typeof deadline === "string" ? new Date(deadline) : deadline;

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return `${deadlineFormatter.format(date)} ${APP_TIME_ZONE_LABEL}`;
}

/**
 * Formats a deadline in an explicit IANA time zone.
 *
 * Push reminders honour the user's stored `notification_preferences.timezone`
 * instead of assuming WIB; an unknown zone falls back to Asia/Jakarta rather
 * than throwing inside the scheduler.
 */
export function formatDeadlineInTimeZone(
  deadline: Date | string,
  timeZone: string = APP_TIME_ZONE,
): string {
  const date = typeof deadline === "string" ? new Date(deadline) : deadline;

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  const zone = isValidTimeZone(timeZone) ? timeZone : APP_TIME_ZONE;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formatter.format(date)} ${zone === APP_TIME_ZONE ? APP_TIME_ZONE_LABEL : zone}`;
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}

/** Formats a plain date (for example a creation timestamp) in Asia/Jakarta. */
export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return dateFormatter.format(date);
}

/**
 * Converts a stored timestamp into the `YYYY-MM-DDTHH:mm` value expected by
 * `<input type="datetime-local">`, using Jakarta wall-clock time.
 */
export function toJakartaDateTimeInput(deadline: Date | string): string {
  const date = typeof deadline === "string" ? new Date(deadline) : deadline;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${lookup("year")}-${lookup("month")}-${lookup("day")}T${lookup("hour")}:${lookup(
    "minute",
  )}`;
}

/**
 * Converts a `datetime-local` value interpreted as Jakarta wall-clock time into
 * an ISO string with an explicit `+07:00` offset.
 *
 * @returns `null` when the input is empty or not a valid wall-clock value.
 */
export function fromJakartaDateTimeInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;

  if (!year || !month || !day || !hour || !minute) {
    return null;
  }

  const candidate = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:00${APP_TIME_ZONE_OFFSET}`,
  );

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  // Reject values the Date constructor silently rolls over (e.g. 31 February).
  const roundTrip = toJakartaDateTimeInput(candidate);

  return roundTrip === `${year}-${month}-${day}T${hour}:${minute}`
    ? candidate.toISOString()
    : null;
}

export function deadlineStateLabel(state: DeadlineState): string {
  switch (state) {
    case "none":
      return "No deadline";
    case "upcoming":
      return "Upcoming";
    case "due_today":
      return "Due today";
    case "overdue":
      return "Overdue";
  }
}
