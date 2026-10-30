import { MapPin } from "lucide-react";
import Link from "next/link";

import {
  EventFormDialog,
  type CalendarFormEvent,
} from "@/components/schedule/event-form-dialog";
import { CALENDAR_EVENT_TONES } from "@/components/schedule/calendar-event-style";
import type {
  CalendarClassOption,
  CalendarEvent,
  CalendarSubjectOption,
} from "@/lib/db/calendar";
import { cn } from "@/lib/utils/cn";
import { CALENDAR_EVENT_TYPE_LABELS } from "@starstask/contracts";
import { formatCalendarTime } from "@starstask/shared";

type EventChipProps = {
  event: CalendarEvent;
  classes: CalendarClassOption[];
  subjects: CalendarSubjectOption[];
  defaultDateKey: string;
};

function toFormEvent(event: CalendarEvent): CalendarFormEvent | null {
  if (event.eventType === "assignment") {
    return null;
  }

  return {
    id: event.sourceId,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    eventType: event.eventType,
    classId: event.classId,
    classSlug: event.classSlug,
    subjectId: event.subjectId,
    status: event.status,
  };
}

function compactLabel(event: CalendarEvent) {
  return (
    <>
      <span className="font-medium">{formatCalendarTime(event.startsAt)}</span>{" "}
      <span>{event.title}</span>
    </>
  );
}

function chipClasses(event: CalendarEvent, compact: boolean): string {
  return cn(
    "block w-full rounded px-1.5 py-1 text-left leading-tight transition-colors",
    compact ? "truncate text-[11px]" : "text-xs",
    CALENDAR_EVENT_TONES[event.eventType],
    event.status === "cancelled" && "line-through opacity-60",
  );
}

/** Read-only sources link out; editable sources open the event dialog. */
export function CalendarEventChip({
  event,
  classes,
  subjects,
  defaultDateKey,
}: EventChipProps) {
  const className = chipClasses(event, true);
  const formEvent = event.editable ? toFormEvent(event) : null;

  if (formEvent) {
    return (
      <EventFormDialog
        scope={formEvent.eventType === "personal" ? "personal" : "official"}
        event={formEvent}
        defaultDateKey={defaultDateKey}
        classes={classes}
        subjects={subjects}
        triggerLabel={compactLabel(event)}
        triggerVariant="ghost"
        triggerSize="sm"
        triggerClassName={cn(className, "h-auto justify-start font-normal")}
        ariaLabel={`Edit ${event.title}`}
      />
    );
  }

  if (event.href) {
    return (
      <Link
        href={event.href}
        className={className}
        title={event.title}
      >
        {compactLabel(event)}
      </Link>
    );
  }

  return (
    <div
      className={className}
      title={event.title}
    >
      {compactLabel(event)}
    </div>
  );
}

/** Full-width row used by the day and agenda views. */
export function CalendarEventRow({
  event,
  classes,
  subjects,
  defaultDateKey,
}: EventChipProps) {
  const formEvent = event.editable ? toFormEvent(event) : null;

  const content = (
    <span className="flex w-full items-start justify-between gap-3">
      <span className="block min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {formatCalendarTime(event.startsAt)}
            {event.endsAt ? `–${formatCalendarTime(event.endsAt)}` : ""}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              CALENDAR_EVENT_TONES[event.eventType],
            )}
          >
            {CALENDAR_EVENT_TYPE_LABELS[event.eventType]}
          </span>
          {event.status === "cancelled" ? (
            <span className="bg-danger-soft text-danger rounded-full px-2 py-0.5 text-[11px] font-medium">
              Cancelled
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "mt-1 block text-sm font-medium",
            event.status === "cancelled" && "line-through opacity-60",
          )}
        >
          {event.title}
        </span>
        {event.description ? (
          <span className="text-muted-foreground mt-1 line-clamp-2 block text-xs">
            {event.description}
          </span>
        ) : null}
        <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {event.className ? <span>{event.className}</span> : null}
          {event.subjectName ? <span>{event.subjectName}</span> : null}
          {event.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin
                aria-hidden="true"
                className="h-3 w-3"
              />
              {event.location}
            </span>
          ) : null}
        </span>
      </span>
      {formEvent ? (
        <span className="text-accent shrink-0 text-xs font-medium">Edit</span>
      ) : null}
      {!formEvent && event.managedInClass ? (
        <span className="text-muted-foreground shrink-0 text-xs">
          Weekly slot
        </span>
      ) : null}
    </span>
  );

  if (formEvent) {
    return (
      <EventFormDialog
        scope={formEvent.eventType === "personal" ? "personal" : "official"}
        event={formEvent}
        defaultDateKey={defaultDateKey}
        classes={classes}
        subjects={subjects}
        triggerLabel={content}
        triggerVariant="ghost"
        triggerSize="sm"
        triggerClassName="border-border hover:bg-subtle h-auto w-full justify-start rounded-lg border px-3 py-2.5 text-left font-normal"
        ariaLabel={`Edit ${event.title}`}
      />
    );
  }

  const rowClass =
    "border-border bg-surface block rounded-lg border px-3 py-2.5";

  if (event.href) {
    return (
      <Link
        href={event.href}
        className={cn(rowClass, "hover:bg-subtle")}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn(rowClass, "bg-subtle")}>{content}</div>;
}
