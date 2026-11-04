"use client";

import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getSessionCheckInWindow,
  getSessionCheckInWindowState,
  SESSION_CHECKIN_ACCURACY_MAX_M,
  CHECKIN_POSITION_MAX_AGE_MS,
  type SessionCheckInWindowState,
} from "@starstask/contracts";
import { formatSessionTime } from "@starstask/shared";
import {
  describeGeolocationError,
  getCurrentPosition,
} from "@/lib/geo/position";

type CheckInRecord = {
  status: "present" | "late" | "excused" | "sick" | "absent";
  checkedInAt: string;
  /** Null when an organizer recorded the row without a reading. */
  distanceM: number | null;
  accuracyM: number | null;
};

type CheckInCardProps = {
  sessionId: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  radiusM: number;
  /** Computed on the server so the first paint matches the API's own clock. */
  initialWindowState: SessionCheckInWindowState;
  initialCheckIn: CheckInRecord | null;
};

/**
 * Self check-in for an in-person session.
 *
 * The browser only supplies a reading; the API re-checks the window, the
 * accuracy, the radius, and class membership. A UI that lies still gets a real
 * error back.
 */
export function CheckInCard({
  sessionId,
  timeZone,
  startsAt,
  endsAt,
  radiusM,
  initialWindowState,
  initialCheckIn,
}: CheckInCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [checkIn, setCheckIn] = React.useState<CheckInRecord | null>(
    initialCheckIn,
  );
  const [nowMs, setNowMs] = React.useState<number | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The clock drives the label only; the database decides whether a check-in is
  // accepted, so a drifted device clock cannot open an early door.
  React.useEffect(() => {
    const tick = () => setNowMs(Date.now());

    tick();
    const timer = window.setInterval(tick, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const checkInWindow = getSessionCheckInWindow(startsAt, endsAt);
  const windowState =
    nowMs === null
      ? initialWindowState
      : getSessionCheckInWindowState(startsAt, endsAt, nowMs);

  const checkInNow = async () => {
    if (isLocating) {
      return;
    }

    setIsLocating(true);
    setError(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;
      const capturedAt = position.capturedAt;

      if (Date.now() - capturedAt > CHECKIN_POSITION_MAX_AGE_MS) {
        setError(
          "Your location is stale. Move somewhere with a clearer signal and try again.",
        );
        return;
      }

      if (accuracy > SESSION_CHECKIN_ACCURACY_MAX_M) {
        setError(
          `Your location is only accurate to about ${Math.round(accuracy)} m. Move somewhere with a clearer signal and try again.`,
        );
        return;
      }

      const response = await fetch(`/api/sessions/${sessionId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, accuracy, capturedAt }),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { checkIn?: CheckInRecord };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not check you in.");
        return;
      }

      const saved = body?.data?.checkIn;

      if (saved) {
        setCheckIn(saved);
      }

      toast({
        variant: "success",
        title: "Checked in",
        description:
          saved?.status === "late"
            ? "Recorded as late. The organizer can change it."
            : "Recorded as present.",
      });
      router.refresh();
    } catch (caught) {
      setError(describeGeolocationError(caught));
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <section
      aria-labelledby="checkin-heading"
      className="border-border bg-surface mt-4 rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="checkin-heading"
          className="flex items-center gap-2 text-base font-semibold"
        >
          <MapPin
            aria-hidden="true"
            className="h-4 w-4"
          />
          Attendance
        </h2>
        <p className="text-muted-foreground text-xs">
          Within {radiusM} m of the room
        </p>
      </div>

      {checkIn ? (
        <div className="mt-3 flex items-start gap-2 text-sm">
          <CheckCircle2
            aria-hidden="true"
            className="text-success mt-0.5 h-4 w-4 shrink-0"
          />
          <div>
            <p className="font-medium">
              Checked in at {formatSessionTime(checkIn.checkedInAt, timeZone)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Recorded as {checkIn.status}.
              {checkIn.distanceM === null
                ? " Added by an organizer without a location."
                : ` About ${Math.round(checkIn.distanceM)} m from the room.`}
            </p>
          </div>
        </div>
      ) : windowState === "open" ? (
        <>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Share your location while you are in the room. If it fails, ask the
            organizer to mark you present.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => void checkInNow()}
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
            {isLocating ? "Getting your location..." : "Check in"}
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {windowState === "before"
            ? `Check-in opens at ${formatSessionTime(
                new Date(
                  checkInWindow?.opensAt ?? Date.parse(startsAt),
                ).toISOString(),
                timeZone,
              )} and stays open until the session ends.`
            : "Check-in for this session has closed."}
        </p>
      )}

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
