import { CheckCircle2, Loader2, MapPin } from "lucide-react";

import {
  SESSION_CAPACITY_MAX,
  SESSION_CHECKIN_ACCURACY_MAX_M,
  SESSION_CHECKIN_RADIUS_MAX,
  SESSION_CHECKIN_RADIUS_MIN,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SessionAssignmentOption } from "@/lib/db/sessions";

import type { SessionFormValues } from "./session-form-model";
import { timeZoneOptions } from "./session-form-model";

export type SessionFieldErrors = Record<string, string>;

type CommonFieldsProps = {
  values: SessionFormValues;
  fieldErrors: SessionFieldErrors;
  onUpdate: <Key extends keyof SessionFormValues>(
    key: Key,
    value: SessionFormValues[Key],
  ) => void;
};

type ScheduleFieldsProps = CommonFieldsProps & {
  assignments: SessionAssignmentOption[];
};

export function SessionBasicsFields({
  values,
  fieldErrors,
  onUpdate,
}: CommonFieldsProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="session-title">Title</Label>
        <Input
          id="session-title"
          value={values.title}
          onChange={(event) => onUpdate("title", event.target.value)}
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
          onChange={(event) => onUpdate("description", event.target.value)}
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
          onChange={(event) => onUpdate("agenda", event.target.value)}
          rows={3}
          maxLength={5_000}
          aria-invalid={Boolean(fieldErrors.agenda)}
        />
      </div>
    </section>
  );
}

export function SessionScheduleFields({
  values,
  fieldErrors,
  onUpdate,
  assignments,
}: ScheduleFieldsProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="session-type">Format</Label>
        <Select
          id="session-type"
          value={values.sessionType}
          onChange={(event) =>
            onUpdate(
              "sessionType",
              event.target.value as SessionFormValues["sessionType"],
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
            onUpdate(
              "visibility",
              event.target.value as SessionFormValues["visibility"],
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
            onChange={(event) => onUpdate("meetingUrl", event.target.value)}
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
            onChange={(event) => onUpdate("location", event.target.value)}
            maxLength={200}
            placeholder="Room 3.04, Faculty of Computer Science"
            aria-invalid={Boolean(fieldErrors.location)}
          />
          <FieldError message={fieldErrors.location} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="session-starts">Starts</Label>
        <Input
          id="session-starts"
          type="datetime-local"
          value={values.startsAt}
          onChange={(event) => onUpdate("startsAt", event.target.value)}
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
          onChange={(event) => onUpdate("endsAt", event.target.value)}
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
          onChange={(event) => onUpdate("timeZone", event.target.value)}
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
          onChange={(event) => onUpdate("capacity", event.target.value)}
          placeholder="No limit"
          aria-invalid={Boolean(fieldErrors.capacity)}
        />
        <FieldError message={fieldErrors.capacity} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="session-deadline">Registration closes (optional)</Label>
        <Input
          id="session-deadline"
          type="datetime-local"
          value={values.registrationDeadline}
          onChange={(event) =>
            onUpdate("registrationDeadline", event.target.value)
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
          onChange={(event) => onUpdate("assignmentId", event.target.value)}
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
  );
}

type AttendanceFieldsProps = {
  radiusM: string;
  onRadiusChange: (value: string) => void;
  capturedAccuracyM: number | null;
  hasExistingLocation: boolean;
  isLocating: boolean;
  error: string | null;
  onCapture: () => void;
  onClear: () => void;
};

/**
 * Optional GPS point for an in-person session. The point is captured from this
 * browser after the session is saved, so the form only reports what was read.
 */
export function SessionAttendanceFields({
  radiusM,
  onRadiusChange,
  capturedAccuracyM,
  hasExistingLocation,
  isLocating,
  error,
  onCapture,
  onClear,
}: AttendanceFieldsProps) {
  const hasCaptured = capturedAccuracyM !== null;
  let captureLabel = "Use my current location";

  if (hasCaptured || hasExistingLocation) {
    captureLabel = "Update from here";
  }

  if (isLocating) {
    captureLabel = "Getting location...";
  }

  return (
    <section
      aria-labelledby="session-attendance"
      className="border-border bg-subtle rounded-xl border p-4 sm:p-5"
    >
      <div className="flex items-start gap-2.5">
        <div className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <MapPin
            aria-hidden="true"
            className="h-4 w-4"
          />
        </div>
        <div>
          <h2
            id="session-attendance"
            className="text-sm font-semibold"
          >
            Attendance location
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Students can check in with GPS only while this session is open.
            Stand in the room when you capture the point.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {hasCaptured ? (
          <Badge variant="success">
            <CheckCircle2
              aria-hidden="true"
              className="h-3 w-3"
            />
            Location captured
          </Badge>
        ) : hasExistingLocation ? (
          <Badge variant="accent">Already enabled</Badge>
        ) : (
          <Badge variant="neutral">Optional</Badge>
        )}

        {hasCaptured ? (
          <span className="text-muted-foreground text-xs">
            Accurate to about {Math.round(capturedAccuracyM)} m
          </span>
        ) : null}
      </div>

      {hasExistingLocation && !hasCaptured ? (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          This session already accepts check-ins. Changing the radius applies
          after you capture the location again.
        </p>
      ) : null}

      <div className="mt-4 max-w-xs space-y-1.5">
        <Label htmlFor="session-attendance-radius">
          Allowed radius (metres)
        </Label>
        <Input
          id="session-attendance-radius"
          type="number"
          min={SESSION_CHECKIN_RADIUS_MIN}
          max={SESSION_CHECKIN_RADIUS_MAX}
          step={5}
          value={radiusM}
          onChange={(event) => onRadiusChange(event.target.value)}
          disabled={isLocating}
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Between {SESSION_CHECKIN_RADIUS_MIN} and {SESSION_CHECKIN_RADIUS_MAX}{" "}
          m. A smaller radius is stricter but less forgiving indoors.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onCapture}
          disabled={isLocating}
          aria-busy={isLocating}
        >
          {isLocating ? (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : (
            <MapPin
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          )}
          {captureLabel}
        </Button>

        {hasCaptured ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={isLocating}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        Only the point and radius are stored; students never see the
        coordinates. A browser reading can be spoofed, so treat check-ins as
        proximity evidence, not proof. You can also set this from the session
        page after saving.
      </p>

      {capturedAccuracyM !== null &&
      capturedAccuracyM > SESSION_CHECKIN_ACCURACY_MAX_M ? (
        <Alert
          variant="warning"
          className="mt-3"
        >
          This reading is only accurate to about {Math.round(capturedAccuracyM)}{" "}
          m. Move somewhere with a clearer signal if students should be allowed
          closer.
        </Alert>
      ) : null}

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-danger text-xs">{message}</p>;
}
