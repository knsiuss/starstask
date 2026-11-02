import { APP_TIME_ZONE, isoToZonedDateTimeInput } from "@starstask/shared";
import type {
  CalendarEventStatus,
  OfficialCalendarEventType,
} from "@starstask/contracts";

export type CalendarFormEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  eventType: OfficialCalendarEventType | "personal";
  classId: string | null;
  classSlug: string | null;
  subjectId: string | null;
  status: CalendarEventStatus;
};

export type CalendarClassChoice = {
  id: string;
  slug: string;
  name: string;
  isAdmin: boolean;
};

export type CalendarSubjectChoice = {
  id: string;
  classId: string;
  name: string;
};

export type EventFormValues = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eventType: OfficialCalendarEventType;
  classId: string;
  subjectId: string;
};

export function buildInitialValues(
  event: CalendarFormEvent | undefined,
  defaultDateKey: string,
  initialClassId: string,
): EventFormValues {
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    startsAt: event
      ? isoToZonedDateTimeInput(event.startsAt, APP_TIME_ZONE)
      : `${defaultDateKey}T09:00`,
    endsAt: event?.endsAt
      ? isoToZonedDateTimeInput(event.endsAt, APP_TIME_ZONE)
      : `${defaultDateKey}T10:00`,
    location: event?.location ?? "",
    eventType:
      event && event.eventType !== "personal"
        ? event.eventType
        : "class_schedule",
    classId: initialClassId,
    subjectId: event?.subjectId ?? "",
  };
}
