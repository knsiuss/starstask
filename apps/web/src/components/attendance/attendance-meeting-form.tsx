"use client";

import { Loader2, LocateFixed, MapPin, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { describeGeolocationError, getCurrentPosition } from "@/lib/geo/position";
import {
  ATTENDANCE_MEETING_LATE_MAX,
  ATTENDANCE_MEETING_LOCATION_MAX,
  ATTENDANCE_MEETING_NUMBER_MAX,
  ATTENDANCE_MEETING_TITLE_MAX,
  attendanceMeetingCreateSchema,
} from "@starstask/contracts";
import { fromJakartaDateTimeInput, toJakartaDateKey } from "@starstask/shared";

const RADIUS_OPTIONS = [50, 100, 200] as const;

type SubjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type CapturedPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type AttendanceMeetingFormProps = {
  classId: string;
  classSlug: string;
  subjects: SubjectOption[];
  /** Called after a meeting is created. */
  onDone?: () => void;
  /**
   * Secondary action. Without it the secondary button clears the fields
   * instead of leaving the form.
   */
  onCancel?: () => void;
  /** Drops the surrounding panel so the caller can provide its own frame. */
  bare?: boolean;
};

function addMinutes(time: string, minutes: number): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) {
    return null;
  }

  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;

  if (total >= 24 * 60) {
    return null;
  }

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Combines the meeting date and a wall-clock time into an ISO instant. */
function meetingInstant(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }

  return fromJakartaDateTimeInput(`${date}T${time}`);
}

/**
 * Create form for one attendance meeting.
 *
 * The date and the times are entered separately because a meeting always
 * happens on its own date; the server still receives full ISO instants.
 */
export function AttendanceMeetingForm({
  classId,
  classSlug,
  subjects,
  onDone,
  onCancel,
  bare = false,
}: AttendanceMeetingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [meetingNumber, setMeetingNumber] = React.useState("1");
  const [title, setTitle] = React.useState("");
  const [meetingDate, setMeetingDate] = React.useState(() =>
    toJakartaDateKey(new Date()),
  );
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [opensTime, setOpensTime] = React.useState("");
  const [closesTime, setClosesTime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [lateAfterMinutes, setLateAfterMinutes] = React.useState("10");
  const [radiusM, setRadiusM] = React.useState("100");
  const [point, setPoint] = React.useState<CapturedPoint | null>(null);
  const [manualLatitude, setManualLatitude] = React.useState("");
  const [manualLongitude, setManualLongitude] = React.useState("");
  const [isLocating, setIsLocating] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  const updateStart = (value: string) => {
    setStartTime(value);

    if (value && !endTime) {
      const suggested = addMinutes(value, 60);

      if (suggested) {
        setEndTime(suggested);
      }
    }
  };

  const clearForm = () => {
    setMeetingNumber("1");
    setTitle("");
    setMeetingDate(toJakartaDateKey(new Date()));
    setStartTime("");
    setEndTime("");
    setOpensTime("");
    setClosesTime("");
    setLocation("");
    setLateAfterMinutes("10");
    setRadiusM("100");
    setPoint(null);
    setManualLatitude("");
    setManualLongitude("");
    setFieldErrors({});
    setError(null);
  };

  const captureLocation = async () => {
    if (isLocating) {
      return;
    }

    setIsLocating(true);
    setError(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;

      setPoint({ latitude, longitude, accuracy });
      setManualLatitude(String(latitude));
      setManualLongitude(String(longitude));
    } catch (caught) {
      setError(describeGeolocationError(caught));
    } finally {
      setIsLocating(false);
    }
  };

  const coordinates = React.useMemo((): CapturedPoint | null => {
    if (manualLatitude.trim() === "" && manualLongitude.trim() === "") {
      return point;
    }

    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude, accuracy: point?.accuracy ?? null };
  }, [manualLatitude, manualLongitude, point]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const startsAtIso = meetingInstant(meetingDate, startTime);
    const endsAtIso = meetingInstant(meetingDate, endTime);
    const opensAtIso = opensTime ? meetingInstant(meetingDate, opensTime) : null;
    const closesAtIso = closesTime ? meetingInstant(meetingDate, closesTime) : null;

    if (!startsAtIso || !endsAtIso) {
      setError("Enter a valid start and end time.");
      return;
    }

    if ((opensTime && !opensAtIso) || (closesTime && !closesAtIso)) {
      setError("Enter a valid check-in window or leave it blank.");
      return;
    }

    if (!coordinates) {
      setError(
        "Share the meeting location or enter its latitude and longitude before saving.",
      );
      return;
    }

    const parsed = attendanceMeetingCreateSchema.safeParse({
      classId,
      subjectId,
      meetingNumber,
      meetingDate,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      opensAt: opensAtIso,
      closesAt: closesAtIso,
      location,
      lateAfterMinutes,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      radiusM,
      title: title || undefined,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path[0];

        if (typeof key === "string" && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      setError("Check the highlighted fields.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings`,
        {
          method: "POST",
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
        setError(body?.error?.message ?? "Could not create the meeting.");
        return;
      }

      toast({
        variant: "success",
        title: "Meeting created",
        description: "Open attendance when the class is ready to check in.",
      });
      clearForm();
      onDone?.();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  if (subjects.length === 0) {
    return (
      <Alert
        variant="warning"
        className={bare ? "" : "mt-4"}
      >
        <p className="text-sm font-medium">This class has no active course</p>
        <p className="mt-1 text-xs leading-relaxed">
          Add a course to the class first. Attendance meetings belong to one
          course so the recap can group them correctly.
        </p>
      </Alert>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={
        bare
          ? "space-y-4"
          : "border-border bg-subtle mt-4 space-y-5 rounded-2xl border p-5"
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="attendance-subject">Subject / Course</Label>
          <Select
            id="attendance-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            aria-invalid={Boolean(fieldErrors.subjectId)}
          >
            {subjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.code ? `${subject.code} · ` : ""}
                {subject.name}
              </option>
            ))}
          </Select>
          {fieldErrors.subjectId ? (
            <p className="text-danger text-xs">{fieldErrors.subjectId}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-meeting-number">Meeting number</Label>
          <Input
            id="attendance-meeting-number"
            type="number"
            min={1}
            max={ATTENDANCE_MEETING_NUMBER_MAX}
            value={meetingNumber}
            onChange={(event) => setMeetingNumber(event.target.value)}
            aria-invalid={Boolean(fieldErrors.meetingNumber)}
          />
          {fieldErrors.meetingNumber ? (
            <p className="text-danger text-xs">{fieldErrors.meetingNumber}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-meeting-date">Meeting date</Label>
          <Input
            id="attendance-meeting-date"
            type="date"
            value={meetingDate}
            onChange={(event) => setMeetingDate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.meetingDate)}
          />
          {fieldErrors.meetingDate ? (
            <p className="text-danger text-xs">{fieldErrors.meetingDate}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-starts-at">Start time</Label>
          <Input
            id="attendance-starts-at"
            type="time"
            value={startTime}
            onChange={(event) => updateStart(event.target.value)}
            aria-invalid={Boolean(fieldErrors.startsAt)}
          />
          {fieldErrors.startsAt ? (
            <p className="text-danger text-xs">{fieldErrors.startsAt}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-ends-at">End time</Label>
          <Input
            id="attendance-ends-at"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            aria-invalid={Boolean(fieldErrors.endsAt)}
          />
          {fieldErrors.endsAt ? (
            <p className="text-danger text-xs">{fieldErrors.endsAt}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-opens-at">
            Check-in opens (optional)
          </Label>
          <Input
            id="attendance-opens-at"
            type="time"
            value={opensTime}
            onChange={(event) => setOpensTime(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-closes-at">
            Check-in closes (optional)
          </Label>
          <Input
            id="attendance-closes-at"
            type="time"
            value={closesTime}
            onChange={(event) => setClosesTime(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-late-after">Late after (minutes)</Label>
          <Input
            id="attendance-late-after"
            type="number"
            min={0}
            max={ATTENDANCE_MEETING_LATE_MAX}
            value={lateAfterMinutes}
            onChange={(event) => setLateAfterMinutes(event.target.value)}
            aria-invalid={Boolean(fieldErrors.lateAfterMinutes)}
          />
          {fieldErrors.lateAfterMinutes ? (
            <p className="text-danger text-xs">
              {fieldErrors.lateAfterMinutes}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-radius">Allowed radius</Label>
          <Select
            id="attendance-radius"
            value={radiusM}
            onChange={(event) => setRadiusM(event.target.value)}
          >
            {RADIUS_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option} metres
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="attendance-location">Location name</Label>
          <Input
            id="attendance-location"
            value={location}
            maxLength={ATTENDANCE_MEETING_LOCATION_MAX}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Room 3.04, Faculty of Computer Science"
            aria-invalid={Boolean(fieldErrors.location)}
          />
          {fieldErrors.location ? (
            <p className="text-danger text-xs">{fieldErrors.location}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-latitude">Latitude</Label>
          <Input
            id="attendance-latitude"
            inputMode="decimal"
            value={manualLatitude}
            onChange={(event) => setManualLatitude(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-longitude">Longitude</Label>
          <Input
            id="attendance-longitude"
            inputMode="decimal"
            value={manualLongitude}
            onChange={(event) => setManualLongitude(event.target.value)}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="attendance-title">Title (optional)</Label>
          <Input
            id="attendance-title"
            value={title}
            maxLength={ATTENDANCE_MEETING_TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Defaults to the course and meeting number"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void captureLocation()}
          disabled={isLocating}
        >
          {isLocating ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <LocateFixed
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Use my location
        </Button>

        {point?.accuracy ? (
          <p className="text-muted-foreground text-[11px]">
            GPS accuracy about {Math.round(point.accuracy)} m
          </p>
        ) : null}
      </div>

      {error ? (
        <Alert variant="error">
          <p className="text-xs leading-relaxed">{error}</p>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isBusy}
        >
          {isBusy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <PlusCircle
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Create session
        </Button>

        {onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearForm}
            disabled={isBusy}
          >
            Clear
          </Button>
        )}
      </div>

      <p className="text-muted-foreground flex items-start gap-1.5 text-[11px] leading-relaxed">
        <MapPin
          aria-hidden="true"
          className="mt-0.5 h-3 w-3 shrink-0"
        />
        Students must check in inside the allowed radius. The meeting point is
        verified on the server.
      </p>
    </form>
  );
}
