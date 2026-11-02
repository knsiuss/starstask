"use client";

import { Loader2, LocateFixed, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  describeGeolocationError,
  getCurrentPosition,
} from "@/lib/geo/position";
import {
  ATTENDANCE_MEETING_LOCATION_REASON_MAX,
  attendanceMeetingLocationChangeSchema,
} from "@starstask/contracts";

const RADIUS_OPTIONS = [50, 100, 200] as const;

type AttendanceMeetingLocationFormProps = {
  classSlug: string;
  sessionId: string;
  currentRadiusM: number;
  onDone: () => void;
};

/**
 * Explicit, audited location change. A location is otherwise locked once the
 * meeting exists, so the reason is required and stored in the audit log.
 */
export function AttendanceMeetingLocationForm({
  classSlug,
  sessionId,
  currentRadiusM,
  onDone,
}: AttendanceMeetingLocationFormProps) {
  const router = useRouter();
  const [latitude, setLatitude] = React.useState("");
  const [longitude, setLongitude] = React.useState("");
  const [accuracy, setAccuracy] = React.useState<number | null>(null);
  const [radiusM, setRadiusM] = React.useState(String(currentRadiusM));
  const [reason, setReason] = React.useState("");
  const [isLocating, setIsLocating] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const capture = async () => {
    if (isLocating) {
      return;
    }

    setIsLocating(true);
    setError(null);

    try {
      const position = await getCurrentPosition();
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
      setAccuracy(position.coords.accuracy);
    } catch (caught) {
      setError(describeGeolocationError(caught));
    } finally {
      setIsLocating(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const parsed = attendanceMeetingLocationChangeSchema.safeParse({
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusM,
      reason,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the location values.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings/${sessionId}/location`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not change the location.");
        return;
      }

      onDone();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border bg-subtle mt-4 space-y-4 rounded-xl border p-4"
    >
      <div>
        <p className="text-sm font-medium">Change the meeting point</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          The change is written to the audit log. Records already saved keep the
          distance measured at check-in time.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="attendance-new-latitude">Latitude</Label>
          <Input
            id="attendance-new-latitude"
            inputMode="decimal"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attendance-new-longitude">Longitude</Label>
          <Input
            id="attendance-new-longitude"
            inputMode="decimal"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attendance-new-radius">Allowed radius</Label>
          <Select
            id="attendance-new-radius"
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
        <div className="space-y-1.5">
          <Label htmlFor="attendance-location-reason">Reason</Label>
          <Input
            id="attendance-location-reason"
            value={reason}
            maxLength={ATTENDANCE_MEETING_LOCATION_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Moved to the lab next door"
          />
        </div>
      </div>

      {accuracy !== null ? (
        <p className="text-muted-foreground text-[11px]">
          GPS accuracy when captured: about {Math.round(accuracy)} m.
        </p>
      ) : null}

      {error ? (
        <Alert variant="error">
          <p className="text-xs leading-relaxed">{error}</p>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void capture()}
          disabled={isLocating || isBusy}
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
            <Save
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Save location
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
