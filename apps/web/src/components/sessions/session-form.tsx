"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  SessionAssignmentOption,
  SessionSummary,
} from "@/lib/db/sessions";
import {
  COMMON_NOTIFICATION_TIMEZONES,
  SESSION_CAPACITY_MAX,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  SESSION_VISIBILITIES,
  sessionCreateSchema,
  sessionUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";
import {
  isoToZonedDateTimeInput,
  zonedDateTimeInputToIso,
} from "@starstask/shared";

type SessionFormProps = {
  classId: string;
  classSlug: string;
  assignments: SessionAssignmentOption[];
  session?: SessionSummary;
  defaultTimeZone: string;
};

type FormValues = {
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

/**
 * Create/edit form for a discussion session.
 *
 * Wall-clock inputs are interpreted in the selected zone and converted to an
 * absolute instant before they are sent, so a session created for Asia/Jakarta
 * keeps its intended local time no matter where it is edited from.
 */
export function SessionForm({
  classId,
  classSlug,
  assignments,
  session,
  defaultTimeZone,
}: SessionFormProps) {
  const router = useRouter();
  const isEdit = Boolean(session);
  const [values, setValues] = React.useState<FormValues>(() =>
    toInitialValues(session, defaultTimeZone),
  );
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const update = <Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const startsAt = zonedDateTimeInputToIso(values.startsAt, values.timeZone);
    const endsAt = zonedDateTimeInputToIso(values.endsAt, values.timeZone);
    const registrationDeadline = values.registrationDeadline
      ? zonedDateTimeInputToIso(values.registrationDeadline, values.timeZone)
      : undefined;

    if (!startsAt || !endsAt) {
      setFieldErrors({
        startsAt: startsAt ? "" : "Enter a valid start date and time",
        endsAt: endsAt ? "" : "Enter a valid end date and time",
      });
      setError("Enter a valid start and end time.");
      return;
    }

    if (values.registrationDeadline && !registrationDeadline) {
      setFieldErrors({ registrationDeadline: "Enter a valid date and time" });
      setError("Enter a valid registration deadline.");
      return;
    }

    const payload = {
      ...(isEdit ? {} : { classId }),
      title: values.title,
      description: values.description,
      agenda: values.agenda || undefined,
      sessionType: values.sessionType,
      meetingUrl: values.meetingUrl || undefined,
      location: values.location || undefined,
      startsAt,
      endsAt,
      timeZone: values.timeZone,
      capacity: values.capacity === "" ? undefined : values.capacity,
      registrationDeadline: registrationDeadline,
      visibility: values.visibility,
      assignmentId: values.assignmentId || undefined,
    };

    const parsed = isEdit
      ? sessionUpdateSchema.safeParse(payload)
      : sessionCreateSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setError("Please fix the highlighted fields.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(
        isEdit ? `/api/sessions/${session?.id}` : "/api/sessions",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(body?.error?.message ?? "Could not save the session.");
        return;
      }

      const id = body?.data?.id ?? session?.id;

      router.push(
        id ? `/sessions/${id}` : `/dashboard/classes/${classSlug}/sessions`,
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-6"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="session-title">Title</Label>
          <Input
            id="session-title"
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            maxLength={160}
            required
            aria-invalid={Boolean(fieldErrors.title)}
            placeholder="Week 9 review session"
          />
          <FieldError message={fieldErrors.title} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-description">Description</Label>
          <Textarea
            id="session-description"
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            rows={4}
            maxLength={5_000}
            required
            aria-invalid={Boolean(fieldErrors.description)}
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-agenda">Agenda (optional)</Label>
          <Textarea
            id="session-agenda"
            value={values.agenda}
            onChange={(event) => update("agenda", event.target.value)}
            rows={3}
            maxLength={5_000}
            aria-invalid={Boolean(fieldErrors.agenda)}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="session-type">Format</Label>
          <Select
            id="session-type"
            value={values.sessionType}
            onChange={(event) =>
              update(
                "sessionType",
                event.target.value as FormValues["sessionType"],
              )
            }
          >
            {SESSION_TYPES.map((type) => (
              <option
                key={type}
                value={type}
              >
                {SESSION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-visibility">Who can see it</Label>
          <Select
            id="session-visibility"
            value={values.visibility}
            onChange={(event) =>
              update(
                "visibility",
                event.target.value as FormValues["visibility"],
              )
            }
          >
            <option value="class_members">Class members only</option>
            <option value="public">Anyone signed in</option>
          </Select>
        </div>

        {values.sessionType === "online" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="session-meeting">Meeting link</Label>
            <Input
              id="session-meeting"
              type="url"
              value={values.meetingUrl}
              onChange={(event) => update("meetingUrl", event.target.value)}
              maxLength={2_048}
              placeholder="https://meet.example.com/abc-defg-hij"
              aria-invalid={Boolean(fieldErrors.meetingUrl)}
            />
            <FieldError message={fieldErrors.meetingUrl} />
          </div>
        ) : (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="session-location">Location</Label>
            <Input
              id="session-location"
              value={values.location}
              onChange={(event) => update("location", event.target.value)}
              maxLength={200}
              placeholder="Room 3.04, Faculty of Computer Science"
              aria-invalid={Boolean(fieldErrors.location)}
            />
            <FieldError message={fieldErrors.location} />
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="session-starts">Starts</Label>
          <Input
            id="session-starts"
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => update("startsAt", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.startsAt)}
          />
          <FieldError message={fieldErrors.startsAt} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-ends">Ends</Label>
          <Input
            id="session-ends"
            type="datetime-local"
            value={values.endsAt}
            onChange={(event) => update("endsAt", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.endsAt)}
          />
          <FieldError message={fieldErrors.endsAt} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-timezone">Time zone</Label>
          <Select
            id="session-timezone"
            value={values.timeZone}
            onChange={(event) => update("timeZone", event.target.value)}
          >
            {timeZoneOptions(values.timeZone).map((zone) => (
              <option
                key={zone}
                value={zone}
              >
                {zone}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-capacity">Capacity (optional)</Label>
          <Input
            id="session-capacity"
            type="number"
            min={1}
            max={SESSION_CAPACITY_MAX}
            value={values.capacity}
            onChange={(event) => update("capacity", event.target.value)}
            placeholder="No limit"
            aria-invalid={Boolean(fieldErrors.capacity)}
          />
          <FieldError message={fieldErrors.capacity} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-deadline">
            Registration closes (optional)
          </Label>
          <Input
            id="session-deadline"
            type="datetime-local"
            value={values.registrationDeadline}
            onChange={(event) =>
              update("registrationDeadline", event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.registrationDeadline)}
          />
          <FieldError message={fieldErrors.registrationDeadline} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="session-assignment">
            Related assignment (optional)
          </Label>
          <Select
            id="session-assignment"
            value={values.assignmentId}
            onChange={(event) => update("assignmentId", event.target.value)}
          >
            <option value="">None</option>
            {assignments.map((assignment) => (
              <option
                key={assignment.id}
                value={assignment.id}
              >
                {assignment.title}
              </option>
            ))}
          </Select>
          <FieldError message={fieldErrors.assignmentId} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={isBusy}
        >
          {isBusy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {isEdit ? "Save changes" : "Schedule session"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isBusy}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-danger text-xs">{message}</p>;
}

function timeZoneOptions(current: string): string[] {
  const zones = new Set<string>(COMMON_NOTIFICATION_TIMEZONES);

  zones.add(current);

  return [...zones];
}

function toInitialValues(
  session: SessionSummary | undefined,
  defaultTimeZone: string,
): FormValues {
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
