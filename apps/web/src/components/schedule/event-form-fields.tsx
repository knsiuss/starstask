import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";

import {
  CALENDAR_EVENT_TYPE_LABELS,
  OFFICIAL_CALENDAR_EVENT_TYPES,
  type CalendarEventStatus,
  type OfficialCalendarEventType,
} from "@starstask/contracts";

import type {
  CalendarClassChoice,
  CalendarFormEvent,
  CalendarSubjectChoice,
  EventFormValues,
} from "@/components/schedule/event-form-model";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EventFormFieldsProps = {
  scope: "personal" | "official";
  event?: CalendarFormEvent;
  values: EventFormValues;
  fieldErrors: Record<string, string>;
  error: string | null;
  busy: boolean;
  adminClasses: CalendarClassChoice[];
  availableSubjects: CalendarSubjectChoice[];
  onUpdate: (patch: Partial<EventFormValues>) => void;
  onChangeClass: (classId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChangeStatus: (status: CalendarEventStatus) => void;
  onRemove: () => void;
};

export function EventFormFields({
  scope,
  event,
  values,
  fieldErrors,
  error,
  busy,
  adminClasses,
  availableSubjects,
  onUpdate,
  onChangeClass,
  onSubmit,
  onChangeStatus,
  onRemove,
}: EventFormFieldsProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 space-y-3"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div>
        <Label htmlFor="event-title">Title</Label>
        <Input
          id="event-title"
          value={values.title}
          onChange={(inputEvent) =>
            onUpdate({ title: inputEvent.target.value })
          }
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
              onChange={(selectEvent) =>
                onChangeClass(selectEvent.target.value)
              }
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
                onUpdate({
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
              onUpdate({ subjectId: selectEvent.target.value })
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
              onUpdate({ startsAt: inputEvent.target.value })
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
              onUpdate({ endsAt: inputEvent.target.value })
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
            onUpdate({ location: inputEvent.target.value })
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
            onUpdate({ description: inputEvent.target.value })
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
                  onChangeStatus(
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
              onClick={onRemove}
            >
              {scope === "personal" ? "Delete" : "Archive"}
            </Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
