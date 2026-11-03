"use client";

import * as React from "react";

import { EventFormFields } from "@/components/schedule/event-form-fields";
import type {
  CalendarClassChoice,
  CalendarFormEvent,
  CalendarSubjectChoice,
} from "@/components/schedule/event-form-model";
import {
  buildInitialValues,
  type EventFormValues,
} from "@/components/schedule/event-form-model";
import { useEventForm } from "@/components/schedule/use-event-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

type EventFormDialogProps = {
  scope: "personal" | "official";
  event?: CalendarFormEvent;
  defaultDateKey: string;
  classes?: CalendarClassChoice[];
  subjects?: CalendarSubjectChoice[];
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  /** Layout for placements that need absolute positioning (the calendar board). */
  triggerStyle?: React.CSSProperties;
  triggerVariant?: NonNullable<React.ComponentProps<typeof Button>["variant"]>;
  triggerSize?: NonNullable<React.ComponentProps<typeof Button>["size"]>;
  ariaLabel?: string;
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
  triggerStyle,
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
          style={triggerStyle}
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
  const adminClasses = classes.filter((item) => item.isAdmin);
  const initialClassId = event?.classId ?? adminClasses[0]?.id ?? "";
  const [values, setValues] = React.useState<EventFormValues>(() =>
    buildInitialValues(event, defaultDateKey, initialClassId),
  );

  const availableSubjects = subjects.filter(
    (subject) => subject.classId === values.classId,
  );
  const selectedClass = adminClasses.find((item) => item.id === values.classId);
  const classSlug = event?.classSlug ?? selectedClass?.slug ?? null;
  const { submit, changeStatus, remove, fieldErrors, error, busy } =
    useEventForm({ scope, event, values, classSlug, onDone });

  const update = (patch: Partial<EventFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const changeClass = (classId: string) => {
    setValues((current) => ({ ...current, classId, subjectId: "" }));
  };

  return (
    <EventFormFields
      scope={scope}
      event={event}
      values={values}
      fieldErrors={fieldErrors}
      error={error}
      busy={busy}
      adminClasses={adminClasses}
      availableSubjects={availableSubjects}
      onUpdate={update}
      onChangeClass={changeClass}
      onSubmit={(formEvent) => void submit(formEvent)}
      onChangeStatus={(status) => void changeStatus(status)}
      onRemove={() => void remove()}
    />
  );
}
