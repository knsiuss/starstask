/**
 * Minimal iCalendar (RFC 5545) writer for the public class feed.
 *
 * A calendar feed is read by clients we cannot test against, so this module
 * stays deliberately small: text escaping, line folding, UTC timestamps, and
 * all-day dates. Anything richer (recurrence, attendees, alarms) is out of
 * scope until a real consumer needs it.
 */

export type IcsEvent = {
  /** Must be stable across refreshes so clients update instead of duplicating. */
  uid: string;
  title: string;
  description?: string | null;
  url?: string | null;
  location?: string | null;
  /** ISO instant for a timed event, or `YYYY-MM-DD` for an all-day event. */
  startsAt: string;
  /** ISO instant or `YYYY-MM-DD`. Defaults to one hour after `startsAt`. */
  endsAt?: string | null;
  allDay?: boolean;
  /** Cancelled events stay in the feed so clients can remove them. */
  status?: "CONFIRMED" | "CANCELLED";
  updatedAt?: string | null;
};

export type IcsCalendar = {
  name: string;
  description?: string | null;
  timeZone?: string;
  events: IcsEvent[];
  /** Should not change between builds; changing it resets client subscriptions. */
  prodId?: string;
};

const DEFAULT_PROD_ID = "-//StarsTask//Class calendar//EN";
const DEFAULT_TIME_ZONE = "Asia/Jakarta";
const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;

/**
 * Escapes the characters RFC 5545 reserves in TEXT values.
 *
 * Order matters: the backslash must be escaped before the newline replacements
 * so an escaped newline is not turned into a literal `\n` backslash sequence.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Folds one content line at 75 octets, as required by RFC 5545.
 *
 * The continuation starts with a single space. Folding counts UTF-8 bytes, not
 * characters, so a multibyte character is never split in half.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    // Continuation lines carry a leading space, so budget one octet for it.
    const limit = chunks.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;

    if (currentBytes + characterBytes > limit) {
      chunks.push(current);
      current = character;
      currentBytes = characterBytes;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }

  chunks.push(current);

  return chunks
    .map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`))
    .join(CRLF);
}

/** UTC basic format used by `DTSTART`/`DTEND`: `20261029T120000Z`. */
export function formatIcsInstant(value: string | Date): string | null {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** `YYYY-MM-DD` to `YYYYMMDD`, or `null` when the value is not a date key. */
export function formatIcsDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCDate() !== Number(day) ||
    parsed.getUTCMonth() + 1 !== Number(month)
  ) {
    return null;
  }

  return `${year}${month}${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function buildEventLines(event: IcsEvent, stamp: string): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${escapeIcsText(event.uid)}`];

  lines.push(`DTSTAMP:${stamp}`);

  const updatedAt = event.updatedAt ? formatIcsInstant(event.updatedAt) : null;
  lines.push(`LAST-MODIFIED:${updatedAt ?? stamp}`);

  if (event.allDay) {
    const start = formatIcsDate(event.startsAt);

    if (!start) {
      return [];
    }

    const end = event.endsAt
      ? formatIcsDate(event.endsAt)
      : formatIcsDate(addDays(event.startsAt, 1));

    if (!end) {
      return [];
    }

    lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`);
  } else {
    const start = formatIcsInstant(event.startsAt);
    const fallbackEnd = new Date(Date.parse(event.startsAt) + 60 * 60 * 1_000);
    const end = event.endsAt
      ? formatIcsInstant(event.endsAt)
      : formatIcsInstant(fallbackEnd);

    if (!start || !end) {
      return [];
    }

    lines.push(`DTSTART:${start}`, `DTEND:${end}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push(`STATUS:${event.status ?? "CONFIRMED"}`, "END:VEVENT");

  return lines;
}

/**
 * Builds a complete calendar. `now` is injectable so tests are deterministic.
 * Invalid events are skipped rather than producing a feed a client will reject.
 */
export function buildIcsCalendar(
  calendar: IcsCalendar,
  now: Date = new Date(),
): string {
  const stamp =
    formatIcsInstant(now) ??
    formatIcsInstant(new Date(0)) ??
    "19700101T000000Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${calendar.prodId ?? DEFAULT_PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendar.name)}`,
    `X-WR-TIMEZONE:${calendar.timeZone ?? DEFAULT_TIME_ZONE}`,
  ];

  if (calendar.description) {
    lines.push(`X-WR-CALDESC:${escapeIcsText(calendar.description)}`);
  }

  for (const event of calendar.events) {
    lines.push(...buildEventLines(event, stamp));
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
}
