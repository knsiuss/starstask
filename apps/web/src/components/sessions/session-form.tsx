"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  SESSION_CHECKIN_RADIUS_MAX,
  SESSION_CHECKIN_RADIUS_MIN,
  sessionCreateSchema,
  sessionUpdateSchema,
  toFieldErrors,
} from "@starstask/contracts";
import { zonedDateTimeInputToIso } from "@starstask/shared";

import {
  SessionAttendanceFields,
  SessionBasicsFields,
  SessionScheduleFields,
  type SessionFieldErrors,
} from "@/components/sessions/session-form-fields";
import {
  toInitialValues,
  type SessionFormValues,
} from "@/components/sessions/session-form-model";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { SessionAssignmentOption, SessionDetail } from "@/lib/db/sessions";
import {
  describeGeolocationError,
  getCurrentPosition,
} from "@/lib/geo/position";

type SessionFormProps = {
  classId: string;
  classSlug: string;
  assignments: SessionAssignmentOption[];
  session?: SessionDetail;
  defaultTimeZone: string;
};

type CapturedPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function parseRadius(value: string): number | null {
  const parsed = Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsed) ||
    parsed < SESSION_CHECKIN_RADIUS_MIN ||
    parsed > SESSION_CHECKIN_RADIUS_MAX
  ) {
    return null;
  }

  return parsed;
}

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
  const { toast } = useToast();
  const isEdit = Boolean(session);
  const [values, setValues] = React.useState<SessionFormValues>(() =>
    toInitialValues(session, defaultTimeZone),
  );
  const [fieldErrors, setFieldErrors] = React.useState<SessionFieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [attendanceRadius, setAttendanceRadius] = React.useState(() =>
    String(session?.checkinRadiusM ?? 150),
  );
  const [capturedPoint, setCapturedPoint] =
    React.useState<CapturedPoint | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  const update = <Key extends keyof SessionFormValues>(
    key: Key,
    value: SessionFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const captureLocation = async () => {
    if (isLocating) {
      return;
    }

    if (parseRadius(attendanceRadius) === null) {
      setLocationError(
        `Choose a radius between ${SESSION_CHECKIN_RADIUS_MIN} and ${SESSION_CHECKIN_RADIUS_MAX} metres.`,
      );
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;

      setCapturedPoint({ latitude, longitude, accuracy });
    } catch (caught) {
      setLocationError(describeGeolocationError(caught));
    } finally {
      setIsLocating(false);
    }
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

    const radiusM = parseRadius(attendanceRadius);

    if (
      values.sessionType === "in_person" &&
      capturedPoint !== null &&
      radiusM === null
    ) {
      setLocationError(
        `Choose a radius between ${SESSION_CHECKIN_RADIUS_MIN} and ${SESSION_CHECKIN_RADIUS_MAX} metres.`,
      );
      setError("Fix the attendance radius before saving.");
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

      if (
        id &&
        values.sessionType === "in_person" &&
        capturedPoint &&
        radiusM
      ) {
        const locationResponse = await fetch(
          `/api/sessions/${id}/checkin-location`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: capturedPoint.latitude,
              longitude: capturedPoint.longitude,
              radiusM,
            }),
          },
        );

        if (!locationResponse.ok) {
          const locationBody = (await locationResponse
            .json()
            .catch(() => null)) as {
            error?: { message?: string };
          } | null;

          // The session already exists; do not keep the form open, because a
          // second submit would create a duplicate. The session page has the
          // same location controls for a retry.
          toast({
            variant: "error",
            title: "Session saved, but the attendance location was not",
            description:
              locationBody?.error?.message ??
              "Open the session to set the check-in point.",
          });
        } else {
          toast({
            variant: "success",
            title: "Attendance location saved",
            description: `Students within ${radiusM} m can check in.`,
          });
        }
      }

      router.push(
        id ? `/sessions/${id}` : `/app/classes/${classSlug}/sessions`,
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

      <SessionBasicsFields
        values={values}
        fieldErrors={fieldErrors}
        onUpdate={update}
      />

      <SessionScheduleFields
        values={values}
        fieldErrors={fieldErrors}
        onUpdate={update}
        assignments={assignments}
      />

      {values.sessionType === "in_person" ? (
        <SessionAttendanceFields
          radiusM={attendanceRadius}
          onRadiusChange={setAttendanceRadius}
          capturedAccuracyM={capturedPoint?.accuracy ?? null}
          hasExistingLocation={session?.hasCheckInLocation ?? false}
          isLocating={isLocating}
          error={locationError}
          onCapture={() => void captureLocation()}
          onClear={() => setCapturedPoint(null)}
        />
      ) : null}

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
