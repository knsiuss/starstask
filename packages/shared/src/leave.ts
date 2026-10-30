/**
 * Calendar-date helpers for leave requests.
 *
 * Leave dates are plain calendar days, not instants. A student asking for leave
 * on 12 March means 12 March wherever they are, so every formatter here reads
 * the value as UTC midnight and formats it in UTC. Parsing a `YYYY-MM-DD` with
 * `new Date(value)` would be safe, but formatting it in local time is not: a
 * viewer west of UTC would see the previous day. Pinning both ends to UTC keeps
 * the printed date identical to the stored date.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayOfMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: "UTC",
});

/** Returns UTC midnight for a `YYYY-MM-DD` value, or null when unusable. */
export function parseCalendarDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  // Rejects 2026-02-30, which Date would silently roll into March.
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

/** "12 Mar 2026" */
export function formatLeaveDate(value: string): string {
  const date = parseCalendarDate(value);

  return date ? dayFormatter.format(date) : value;
}

/**
 * Collapses a range into the shortest unambiguous form:
 * "12 Mar 2026", "12–14 Mar 2026", or "28 Feb – 3 Mar 2026".
 */
export function formatLeaveDateRange(start: string, end: string): string {
  if (start === end) {
    return formatLeaveDate(start);
  }

  const startDate = parseCalendarDate(start);
  const endDate = parseCalendarDate(end);

  if (!startDate || !endDate) {
    return `${start} – ${end}`;
  }

  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();

  if (!sameYear) {
    return `${formatLeaveDate(start)} – ${formatLeaveDate(end)}`;
  }

  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();

  // Inside one month the month is printed once: "12–14 Mar 2026".
  return sameMonth
    ? `${dayOfMonthFormatter.format(startDate)}–${formatLeaveDate(end)}`
    : `${dayMonthFormatter.format(startDate)} – ${formatLeaveDate(end)}`;
}

/** Inclusive day count, so a single-day request is 1. */
export function leaveDayCount(start: string, end: string): number {
  const startDate = parseCalendarDate(start);
  const endDate = parseCalendarDate(end);

  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  return Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
}

/** Reporting period label for a report header. */
export function formatLeaveReportPeriod(
  from: string | null,
  to: string | null,
): string {
  if (from && to) {
    return formatLeaveDateRange(from, to);
  }

  if (from) {
    return `From ${formatLeaveDate(from)}`;
  }

  if (to) {
    return `Up to ${formatLeaveDate(to)}`;
  }

  return "All dates";
}

/** Filesystem-safe slug fragment: lowercase, dashes, no traversal. */
export function sanitizeFilenameSegment(value: string, maxLength = 40): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);

  return cleaned.length > 0 ? cleaned : "class";
}

/**
 * Report filename, e.g. `starstask-absence-cs101-2026-01-01-2026-03-31-summary.pdf`.
 *
 * Built only from validated segments: no user-supplied filename ever reaches the
 * `Content-Disposition` header.
 */
export function buildLeaveReportFilename(options: {
  classSlug: string;
  format: "summary" | "complete";
  from: string | null;
  to: string | null;
}): string {
  const parts = [
    "starstask-absence",
    sanitizeFilenameSegment(options.classSlug),
    options.from ?? "start",
    options.to ?? "today",
    options.format,
  ];

  return `${parts.join("-")}.pdf`;
}
