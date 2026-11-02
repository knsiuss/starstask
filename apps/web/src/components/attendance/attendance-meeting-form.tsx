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
import {
  describeGeolocationError,
  getCurrentPosition,
} from "@/lib/geo/position";
import {
  ATTENDANCE_MEETING_LATE_MAX,
  ATTENDANCE_MEETING_LOCATION_MAX,
  ATTENDANCE_MEETING_NUMBER_MAX,
  ATTENDANCE_MEETING_TITLE_MAX,
  attendanceMeetingCreateSchema,
} from "@starstask/contracts";
import {
  fromJakartaDateTimeInput,
  toJakartaDateTimeInput,
} from "@starstask/shared";

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
  onDone: () => void;
};

function toDatePart(value: string): string {
  return value.slice(0, 10);
}

/** Create form for one attendance meeting. The server re-validates everything. */
export function AttendanceMeetingForm({
  classId,
  classSlug,
  subjects,
  onDone,
}: AttendanceMeetingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [meetingNumber, setMeetingNumber] = React.useState("1");
  const [title, setTitle] = React.useState("");
  const [meetingDate, setMeetingDate] = React.useState("");
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [opensAt, setOpensAt] = React.useState("");
  const [closesAt, setClosesAt] = React.useState("");
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
    setStartsAt(value);

    if (value.length >= 16) {
      setMeetingDate(toDatePart(value));
    }

    if (!endsAt && value.length >= 16) {
      const start = new Date(`${value}:00+07:00`);

      if (!Number.isNaN(start.getTime())) {
        setEndsAt(
          toJakartaDateTimeInput(new Date(start.getTime() + 60 * 60 * 1_000)),
        );
      }
    }
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

    const startsAtIso = fromJakartaDateTimeInput(startsAt);
    const endsAtIso = fromJakartaDateTimeInput(endsAt);
    const opensAtIso = opensAt ? fromJakartaDateTimeInput(opensAt) : null;
    const closesAtIso = closesAt ? fromJakartaDateTimeInput(closesAt) : null;

    if (!startsAtIso || !endsAtIso) {
      setError("Enter a valid start and end time.");
      return;
    }

    if ((opensAt && !opensAtIso) || (closesAt && !closesAtIso)) {
      setError("Enter a valid attendance window or leave it blank.");
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
      meetingDate: meetingDate || toDatePart(startsAt),
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
      onDone();
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
        className="mt-4"
      >
        <p className="text-sm font-medium">This class has no active subject</p>
        <p className="mt-1 text-xs leading-relaxed">
          Add a subject to the class first. Attendance meetings belong to one
          subject so the recap can group them correctly.
        </p>
      </Alert>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-border bg-subtle mt-4 space-y-5 rounded-2xl border p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="attendance-subject">Subject</Label>
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
          <Label htmlFor="attendance-starts-at">Starts</Label>
          <Input
            id="attendance-starts-at"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => updateStart(event.target.value)}
            aria-invalid={Boolean(fieldErrors.startsAt)}
          />
          {fieldErrors.startsAt ? (
            <p className="text-danger text-xs">{fieldErrors.startsAt}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-ends-at">Ends</Label>
          <Input
            id="attendance-ends-at"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            aria-invalid={Boolean(fieldErrors.endsAt)}
          />
          {fieldErrors.endsAt ? (
            <p className="text-danger text-xs">{fieldErrors.endsAt}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-opens-at">Check-in opens (optional)</Label>
          <Input
            id="attendance-opens-at"
            type="datetime-local"
            value={opensAt}
            onChange={(event) => setOpensAt(event.target.value)}
          />
          <p className="text-muted-foreground text-[11px]">
            Defaults to the start time when you open the meeting.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-closes-at">
            Check-in closes (optional)
          </Label>
          <Input
            id="attendance-closes-at"
            type="datetime-local"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
          />
          <p className="text-muted-foreground text-[11px]">
            Defaults to the end time. A check-in after the late deadline is
            recorded as late.
          </p>
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="attendance-title">Title (optional)</Label>
          <Input
            id="attendance-title"
            value={title}
            maxLength={ATTENDANCE_MEETING_TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Defaults to the subject and meeting number"
          />
        </div>
      </div>

      <div className="border-border rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin
                aria-hidden="true"
                className="h-4 w-4"
              />
              Meeting point
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Students must be inside the radius. Share your location from the
              classroom, or enter the coordinates manually.
            </p>
          </div>
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
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
        </div>

        {point?.accuracy ? (
          <p className="text-muted-foreground mt-2 text-[11px]">
            GPS accuracy when captured: about {Math.round(point.accuracy)} m.
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
          Create meeting
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={isBusy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
