import {
  COMMON_NOTIFICATION_TIMEZONES,
  SESSION_TYPES,
  SESSION_VISIBILITIES,
} from "@starstask/contracts";
import { isoToZonedDateTimeInput } from "@starstask/shared";

import type { SessionSummary } from "@/lib/db/sessions";

export type SessionFormValues = {
  title: string;
  description: string;
  agenda: string;
  sessionType: (typeof SESSION_TYPES)[number];
  meetingUrl: string;
  location: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  capacity: string;
  registrationDeadline: string;
  visibility: (typeof SESSION_VISIBILITIES)[number];
  assignmentId: string;
};

export function timeZoneOptions(current: string): string[] {
  const zones = new Set<string>(COMMON_NOTIFICATION_TIMEZONES);

  zones.add(current);

  return [...zones];
}

export function toInitialValues(
  session: SessionSummary | undefined,
  defaultTimeZone: string,
): SessionFormValues {
  if (!session) {
    return {
      title: "",
      description: "",
      agenda: "",
      sessionType: "online",
      meetingUrl: "",
      location: "",
      startsAt: "",
      endsAt: "",
      timeZone: defaultTimeZone,
      capacity: "",
      registrationDeadline: "",
      visibility: "class_members",
      assignmentId: "",
    };
  }

  return {
    title: session.title,
    description: session.description,
    agenda: session.agenda ?? "",
    sessionType: session.sessionType,
    meetingUrl: session.meetingUrl ?? "",
    location: session.location ?? "",
    startsAt: isoToZonedDateTimeInput(session.startsAt, session.timeZone),
    endsAt: isoToZonedDateTimeInput(session.endsAt, session.timeZone),
    timeZone: session.timeZone,
    capacity: session.capacity === null ? "" : String(session.capacity),
    registrationDeadline: session.registrationDeadline
      ? isoToZonedDateTimeInput(session.registrationDeadline, session.timeZone)
      : "",
    visibility: session.visibility,
    assignmentId: session.assignmentId ?? "",
  };
}
