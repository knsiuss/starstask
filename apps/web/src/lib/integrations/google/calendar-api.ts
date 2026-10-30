import "server-only";

import { buildCalendarDetails } from "@starstask/shared";

import {
  GOOGLE_CALENDAR_API_BASE,
  STARSTASK_EVENT_PROPERTY,
} from "@/lib/integrations/google/config";

const REQUEST_TIMEOUT_MS = 10_000;

export type CalendarEventSource = {
  id: string;
  title: string;
  description: string;
  agenda: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  meetingUrl: string | null;
};

export type GoogleApiErrorCategory =
  "transient" | "unauthorized" | "not_found" | "invalid_request";

export class GoogleApiError extends Error {
  constructor(
    readonly category: GoogleApiErrorCategory,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

/**
 * Event body for one session.
 *
 * The description is built by the same helper the "Add to Google Calendar" link
 * uses, so both paths show the same text and neither includes participant data.
 * The private extended property is how a retry recognises an event it already
 * created, even if the mapping row was never written.
 */
export function buildGoogleEventBody(session: CalendarEventSource) {
  return {
    summary: session.title,
    description: buildCalendarDetails({
      title: session.title,
      description: session.description,
      agenda: session.agenda,
      meetingUrl: session.meetingUrl,
      location: session.location,
    }),
    location: session.meetingUrl ?? session.location ?? undefined,
    start: { dateTime: session.startsAt, timeZone: session.timeZone },
    end: { dateTime: session.endsAt, timeZone: session.timeZone },
    extendedProperties: {
      private: { [STARSTASK_EVENT_PROPERTY]: session.id },
    },
    reminders: { useDefault: true },
  };
}

async function request(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new GoogleApiError("transient", 0, "Calendar API unreachable");
  }

  if (response.ok) {
    return response;
  }

  if (response.status === 401) {
    throw new GoogleApiError("unauthorized", 401, "Access token rejected");
  }

  if (response.status === 404 || response.status === 410) {
    throw new GoogleApiError("not_found", response.status, "Event not found");
  }

  if (response.status === 429 || response.status >= 500) {
    throw new GoogleApiError(
      "transient",
      response.status,
      "Calendar API failed",
    );
  }

  throw new GoogleApiError(
    "invalid_request",
    response.status,
    "Calendar API rejected the request",
  );
}

/** Looks up the event StarsTask previously created for this session. */
export async function findManagedEvent(
  accessToken: string,
  calendarId: string,
  sessionId: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    privateExtendedProperty: `${STARSTASK_EVENT_PROPERTY}=${sessionId}`,
    maxResults: "1",
    singleEvents: "true",
    showDeleted: "false",
  });

  const response = await request(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  const payload = (await response.json().catch(() => null)) as {
    items?: { id?: unknown }[];
  } | null;
  const id = payload?.items?.[0]?.id;

  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function insertManagedEvent(
  accessToken: string,
  calendarId: string,
  body: ReturnType<typeof buildGoogleEventBody>,
): Promise<string> {
  const response = await request(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(body) },
  );
  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
  } | null;

  if (typeof payload?.id !== "string" || payload.id.length === 0) {
    throw new GoogleApiError(
      "invalid_request",
      200,
      "Calendar API returned no event id",
    );
  }

  return payload.id;
}

export async function updateManagedEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: ReturnType<typeof buildGoogleEventBody>,
): Promise<void> {
  await request(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

/** @returns `true` when the event existed and was removed. */
export async function deleteManagedEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  try {
    await request(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );

    return true;
  } catch (error) {
    if (error instanceof GoogleApiError && error.category === "not_found") {
      return false;
    }

    throw error;
  }
}
