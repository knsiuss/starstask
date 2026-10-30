"use client";

import { Loader2, MapPin, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  SESSION_CHECKIN_RADIUS_MAX,
  SESSION_CHECKIN_RADIUS_MIN,
} from "@starstask/contracts";

const RADIUS_CHOICES = [50, 100, 150, 250, 500];

type CheckInLocationCardProps = {
  sessionId: string;
  hasCheckInLocation: boolean;
  radiusM: number;
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });
}

/**
 * Saves the room an organizer is standing in.
 *
 * The organizer must be on site when pressing the button, because the point is
 * read from their own browser. The note under the controls says plainly that a
 * browser reading is self-reported.
 */
export function CheckInLocationCard({
  sessionId,
  hasCheckInLocation,
  radiusM,
}: CheckInLocationCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [radius, setRadius] = React.useState(radiusM);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const radiusChoices = Array.from(new Set([...RADIUS_CHOICES, radius])).sort(
    (left, right) => left - right,
  );

  const saveLocation = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      const response = await fetch(
        `/api/sessions/${sessionId}/checkin-location`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude, radiusM: radius }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save the location.");
        return;
      }

      toast({
        variant: "success",
        title: "Check-in location saved",
        description: `Students within ${radius} m can now check in.`,
      });
      router.refresh();
    } catch {
      setError(
        "Could not read your location. Allow location access for this site and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const clearLocation = async () => {
    if (isClearing) {
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/checkin-location`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not turn check-in off.");
        return;
      }

      setIsConfirmingClear(false);
      toast({ variant: "info", title: "Check-in turned off" });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <section
      aria-labelledby="checkin-location-heading"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <h2
        id="checkin-location-heading"
        className="text-sm font-semibold"
      >
        Check-in location
      </h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {hasCheckInLocation
          ? `Students within ${radiusM} m of the saved point can check in from 15 minutes before the start until the session ends.`
          : "Stand in the room, then save the point students must be near to check in."}
      </p>

      <label
        htmlFor="checkin-radius"
        className="text-muted-foreground mt-4 block text-xs font-medium"
      >
        Radius
      </label>
      <select
        id="checkin-radius"
        value={radius}
        onChange={(event) => setRadius(Number(event.target.value))}
        disabled={isSaving}
        className="border-border bg-surface focus-visible:outline-accent mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {radiusChoices.map((choice) => (
          <option
            key={choice}
            value={choice}
          >
            {choice} m
          </option>
        ))}
      </select>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Between {SESSION_CHECKIN_RADIUS_MIN} and {SESSION_CHECKIN_RADIUS_MAX} m.
        A smaller radius is stricter but less forgiving indoors.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void saveLocation()}
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? (
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
          {hasCheckInLocation ? "Update from here" : "Use my location"}
        </Button>

        {hasCheckInLocation ? (
          <Dialog
            open={isConfirmingClear}
            onOpenChange={setIsConfirmingClear}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isClearing}
              >
                <Trash2
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Turn off
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Turn off check-in?</DialogTitle>
              <DialogDescription>
                The saved point is removed and new check-ins are rejected.
                Attendance already recorded stays in the list.
              </DialogDescription>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsConfirmingClear(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void clearLocation()}
                  disabled={isClearing}
                  aria-busy={isClearing}
                >
                  {isClearing ? "Turning off..." : "Turn off check-in"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        Location comes from this browser, so it can be spoofed. Treat check-ins
        as a strong prompt, not proof.
      </p>

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
