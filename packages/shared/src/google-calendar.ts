/**
 * "Add to Google Calendar" link builder.
 *
 * This is the whole of Stage A: a plain URL the user opens themselves. It needs
 * no OAuth grant, no API call, and no access to anyone's calendar, so it works
 * even when the optional Calendar API integration is not configured.
 */

const GOOGLE_CALENDAR_RENDER_URL =
  "https://calendar.google.com/calendar/render";

/** Google truncates long descriptions; keeping well under the limit is safer. */
const MAX_DETAILS_LENGTH = 1_200;

export type GoogleCalendarLinkInput = {
  title: string;
  description: string;
  agenda?: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location?: string | null;
  meetingUrl?: string | null;
  status: string;
};

/** Google expects the UTC basic format: `20261029T120000Z`. */
export function toGoogleCalendarDate(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Builds the event description from public session data only.
 *
 * Participant names, RSVP state, and organizer identity are deliberately absent:
 * a calendar event can be shared or exported, so it must not become a second
 * copy of the participant list.
 */
export function buildCalendarDetails(
  input: Pick<
    GoogleCalendarLinkInput,
    "description" | "agenda" | "meetingUrl" | "location" | "title"
  >,
): string {
  const parts = [input.description.trim()];

  if (input.agenda && input.agenda.trim().length > 0) {
    parts.push(`Agenda:\n${input.agenda.trim()}`);
  }

  if (input.meetingUrl) {
    parts.push(`Join online: ${input.meetingUrl}`);
  } else if (input.location) {
    parts.push(`Location: ${input.location.trim()}`);
  }

  parts.push(`Session: ${input.title.trim()}`);

  const details = parts.filter(Boolean).join("\n\n");

  return details.length <= MAX_DETAILS_LENGTH
    ? details
    : `${details.slice(0, MAX_DETAILS_LENGTH - 1)}…`;
}

/**
 * Returns the calendar link, or `null` when the session is not scheduled or its
 * times cannot be parsed. A cancelled session must not offer a link that would
 * recreate an event for a meeting that will not happen.
 */
export function buildGoogleCalendarUrl(
  input: GoogleCalendarLinkInput,
): string | null {
  if (input.status !== "scheduled") {
    return null;
  }

  const start = toGoogleCalendarDate(input.startsAt);
  const end = toGoogleCalendarDate(input.endsAt);

  if (
    !start ||
    !end ||
    Date.parse(input.endsAt) <= Date.parse(input.startsAt)
  ) {
    return null;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title.trim(),
    dates: `${start}/${end}`,
    details: buildCalendarDetails(input),
    ctz: input.timeZone,
  });

  const location = input.meetingUrl ?? input.location ?? null;

  if (location) {
    params.set("location", location.trim());
  }

  return `${GOOGLE_CALENDAR_RENDER_URL}?${params.toString()}`;
}
