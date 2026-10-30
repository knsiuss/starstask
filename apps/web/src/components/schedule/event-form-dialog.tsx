"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import {
  CALENDAR_EVENT_TYPE_LABELS,
  OFFICIAL_CALENDAR_EVENT_TYPES,
  classCalendarEventCreateSchema,
  personalCalendarEventCreateSchema,
  toFieldErrors,
  type CalendarEventStatus,
  type OfficialCalendarEventType,
} from "@starstask/contracts";
import {
  APP_TIME_ZONE,
  isoToZonedDateTimeInput,
  zonedDateTimeInputToIso,
} from "@starstask/shared";

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

type CalendarClassChoice = {
  id: string;
  slug: string;
  name: string;
  isAdmin: boolean;
};

type CalendarSubjectChoice = {
  id: string;
  classId: string;
  name: string;
};

type EventFormDialogProps = {
  scope: "personal" | "official";
  event?: CalendarFormEvent;
  defaultDateKey: string;
  classes?: CalendarClassChoice[];
  subjects?: CalendarSubjectChoice[];
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  triggerVariant?: NonNullable<React.ComponentProps<typeof Button>["variant"]>;
  triggerSize?: NonNullable<React.ComponentProps<typeof Button>["size"]>;
  ariaLabel?: string;
};

type FormValues = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eventType: OfficialCalendarEventType;
  classId: string;
  subjectId: string;
};

type ApiErrorBody = {
  error?: {
    message?: string;
    fieldErrors?: Record<string, string>;
  };
};

/**
 * One dialog for personal events and official class events.
 *
 * The scope picks the endpoint and the fields, while the API re-checks the
 * session and the class role. A class admin cannot reach another group because
 * the endpoint is always the class slug the form opened with.
 */
export function EventFormDialog({
  scope,
  event,
  defaultDateKey,
  classes = [],
  subjects = [],
  triggerLabel,
  triggerClassName,
  triggerVariant = "primary",
  triggerSize = "md",
  ariaLabel,
}: EventFormDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            buttonVariants({ variant: triggerVariant, size: triggerSize }),
            triggerClassName,
          )}
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-3rem)] max-w-lg overflow-y-auto">
        <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        <DialogDescription>
          {scope === "personal"
            ? "Personal events are visible only to you."
            : "Official events are visible to everyone in the class group."}
        </DialogDescription>
        {open ? (
          <EventForm
            scope={scope}
            event={event}
            defaultDateKey={defaultDateKey}
            classes={classes}
            subjects={subjects}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  scope,
  event,
  defaultDateKey,
  classes,
  subjects,
  onDone,
}: {
  scope: "personal" | "official";
  event?: CalendarFormEvent;
  defaultDateKey: string;
  classes: CalendarClassChoice[];
  subjects: CalendarSubjectChoice[];
  onDone: () => void;
}) {
  const router = useRouter();
  const adminClasses = classes.filter((item) => item.isAdmin);
  const initialClassId = event?.classId ?? adminClasses[0]?.id ?? "";
  const [values, setValues] = React.useState<FormValues>({
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
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const availableSubjects = subjects.filter(
    (subject) => subject.classId === values.classId,
  );
  const selectedClass = adminClasses.find((item) => item.id === values.classId);
  const classSlug = event?.classSlug ?? selectedClass?.slug ?? null;

  const update = (patch: Partial<FormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const changeClass = (classId: string) => {
    setValues((current) => ({ ...current, classId, subjectId: "" }));
  };

  const submit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();

    if (busy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const startsAt = zonedDateTimeInputToIso(values.startsAt, APP_TIME_ZONE);
    const endsAt = zonedDateTimeInputToIso(values.endsAt, APP_TIME_ZONE);

    if (!startsAt || !endsAt) {
      const message = "Use a valid date and time.";
      setFieldErrors({ startsAt: message, endsAt: message });
      setError(message);
      return;
    }

    const base = {
      title: values.title,
      description: values.description,
      startsAt,
      endsAt,
      timeZone: APP_TIME_ZONE,
      location: values.location,
    };

    const parsed =
      scope === "personal"
        ? personalCalendarEventCreateSchema.safeParse(base)
        : classCalendarEventCreateSchema.safeParse({
            ...base,
            eventType: values.eventType,
            subjectId: values.subjectId || undefined,
          });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(
        errors.title ??
          errors.startsAt ??
          errors.endsAt ??
          errors.subjectId ??
          "Check the highlighted fields.",
      );
      return;
    }

    if (scope === "official" && !classSlug) {
      setError("Choose the class this event belongs to.");
      return;
    }

    const endpoint =
      scope === "personal"
        ? event
          ? `/api/calendar/personal/${event.id}`
          : "/api/calendar/personal"
        : event
          ? `/api/classes/${classSlug}/calendar-events/${event.id}`
          : `/api/classes/${classSlug}/calendar-events`;

    setBusy(true);

    try {
      const response = await fetch(endpoint, {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ApiErrorBody | null;
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(body?.error?.message ?? "Could not save the event.");
        return;
      }

      onDone();
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: CalendarEventStatus) => {
    if (busy || !event) {
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const endpoint =
        scope === "personal"
          ? `/api/calendar/personal/${event.id}/status`
          : `/api/classes/${event.classSlug}/calendar-events/${event.id}/status`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ApiErrorBody | null;
        setError(body?.error?.message ?? "Could not change the event status.");
        return;
      }

      onDone();
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !event) {
      return;
    }

    const confirmed = window.confirm(
      scope === "personal"
        ? "Delete this personal event?"
        : "Archive this event? It disappears from the calendar but stays on record.",
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const endpoint =
        scope === "personal"
          ? `/api/calendar/personal/${event.id}`
          : `/api/classes/${event.classSlug}/calendar-events/${event.id}`;
      const response = await fetch(endpoint, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ApiErrorBody | null;
        setError(
          body?.error?.message ??
            (scope === "personal"
              ? "Could not delete the event."
              : "Could not archive the event."),
        );
        return;
      }

      onDone();
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-3"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div>
        <Label htmlFor="event-title">Title</Label>
        <Input
          id="event-title"
          value={values.title}
          onChange={(inputEvent) => update({ title: inputEvent.target.value })}
          aria-invalid={Boolean(fieldErrors.title)}
          maxLength={160}
          className="mt-1"
        />
        {fieldErrors.title ? (
          <p className="text-danger mt-1 text-xs">{fieldErrors.title}</p>
        ) : null}
      </div>

      {scope === "official" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="event-class">Class</Label>
            <Select
              id="event-class"
              value={values.classId}
              onChange={(selectEvent) => changeClass(selectEvent.target.value)}
              disabled={Boolean(event)}
              className="mt-1"
            >
              <option value="">Choose a class</option>
              {adminClasses.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="event-type">Type</Label>
            <Select
              id="event-type"
              value={values.eventType}
              onChange={(selectEvent) =>
                update({
                  eventType: selectEvent.target
                    .value as OfficialCalendarEventType,
                })
              }
              className="mt-1"
            >
              {OFFICIAL_CALENDAR_EVENT_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {CALENDAR_EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {scope === "official" ? (
        <div>
          <Label htmlFor="event-subject">Subject (optional)</Label>
          <Select
            id="event-subject"
            value={values.subjectId}
            onChange={(selectEvent) =>
              update({ subjectId: selectEvent.target.value })
            }
            aria-invalid={Boolean(fieldErrors.subjectId)}
            className="mt-1"
          >
            <option value="">No specific subject</option>
            {availableSubjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.name}
              </option>
            ))}
          </Select>
          {fieldErrors.subjectId ? (
            <p className="text-danger mt-1 text-xs">{fieldErrors.subjectId}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="event-start">Starts</Label>
          <Input
            id="event-start"
            type="datetime-local"
            step={60}
            value={values.startsAt}
            onChange={(inputEvent) =>
              update({ startsAt: inputEvent.target.value })
            }
            aria-invalid={Boolean(fieldErrors.startsAt)}
            className="mt-1"
          />
          {fieldErrors.startsAt ? (
            <p className="text-danger mt-1 text-xs">{fieldErrors.startsAt}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="event-end">Ends</Label>
          <Input
            id="event-end"
            type="datetime-local"
            step={60}
            value={values.endsAt}
            onChange={(inputEvent) =>
              update({ endsAt: inputEvent.target.value })
            }
            aria-invalid={Boolean(fieldErrors.endsAt)}
            className="mt-1"
          />
          {fieldErrors.endsAt ? (
            <p className="text-danger mt-1 text-xs">{fieldErrors.endsAt}</p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="event-location">Location (optional)</Label>
        <Input
          id="event-location"
          value={values.location}
          onChange={(inputEvent) =>
            update({ location: inputEvent.target.value })
          }
          maxLength={200}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="event-description">Description (optional)</Label>
        <Textarea
          id="event-description"
          value={values.description}
          onChange={(inputEvent) =>
            update({ description: inputEvent.target.value })
          }
          aria-invalid={Boolean(fieldErrors.description)}
          maxLength={scope === "personal" ? 2_000 : 5_000}
          className="mt-1 min-h-20"
        />
        {fieldErrors.description ? (
          <p className="text-danger mt-1 text-xs">{fieldErrors.description}</p>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        Times are shown and saved in Asia/Jakarta (WIB).
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="submit"
          disabled={busy}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {event ? "Save changes" : "Create event"}
        </Button>
        {event ? (
          <>
            {scope === "official" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void changeStatus(
                    event.status === "cancelled" ? "published" : "cancelled",
                  )
                }
              >
                {event.status === "cancelled" ? "Reopen" : "Cancel event"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {scope === "personal" ? "Delete" : "Archive"}
            </Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
