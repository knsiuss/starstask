"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  classCalendarEventCreateSchema,
  personalCalendarEventCreateSchema,
  toFieldErrors,
  type CalendarEventStatus,
} from "@starstask/contracts";
import { APP_TIME_ZONE, zonedDateTimeInputToIso } from "@starstask/shared";

import type {
  CalendarFormEvent,
  EventFormValues,
} from "@/components/schedule/event-form-model";

type ApiErrorBody = {
  error?: {
    message?: string;
    fieldErrors?: Record<string, string>;
  };
};

type UseEventFormOptions = {
  scope: "personal" | "official";
  event?: CalendarFormEvent;
  values: EventFormValues;
  classSlug: string | null;
  onDone: () => void;
};

/**
 * Mutation state for one calendar event form: save, status change, and
 * delete/archive. The field values stay in the caller so typing never touches
 * network state.
 */
export function useEventForm({
  scope,
  event,
  values,
  classSlug,
  onDone,
}: UseEventFormOptions) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  return { submit, changeStatus, remove, fieldErrors, error, busy };
}
