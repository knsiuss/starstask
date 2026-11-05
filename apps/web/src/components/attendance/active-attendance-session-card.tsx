"use client";

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MoreHorizontal,
  Settings2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckInResultDialog,
  type CheckInResultFailure,
  type CheckInResultSuccess,
} from "@/components/attendance/check-in-result-dialog";
import { LocationPermissionDialog } from "@/components/attendance/location-permission-dialog";
import type {
  ActiveAttendanceSession,
  AttendanceCheckInStatus,
} from "@/lib/attendance/types";
import { describeCheckInFailure } from "@/lib/attendance/check-in-errors";
import {
  describeGeolocationError,
  getCurrentPosition,
} from "@/lib/geo/position";
import {
  ATTENDANCE_STATUS_LABELS,
  getSessionCheckInWindow,
  getSessionCheckInWindowState,
  CHECKIN_POSITION_MAX_AGE_MS,
  SESSION_CHECKIN_ACCURACY_MAX_M,
} from "@starstask/contracts";
import {
  formatSessionDate,
  formatSessionTime,
  timeZoneLabel,
} from "@starstask/shared";

const STATUS_BADGE: Record<
  AttendanceCheckInStatus,
  "success" | "warning" | "accent" | "danger"
> = {
  present: "success",
  late: "warning",
  excused: "accent",
  sick: "accent",
  absent: "danger",
};

type SavedCheckIn = {
  status: AttendanceCheckInStatus;
  checkedInAt: string;
  distanceM: number | null;
};

/**
 * One live session card. The browser supplies a reading and the API decides
 * whether it counts; a failed validation is shown as a real error, never as a
 * silent success.
 */
export function ActiveAttendanceSessionCard({
  session,
  mode = "student",
}: {
  session: ActiveAttendanceSession;
  /** Managers open the session to record attendance instead of checking in. */
  mode?: "student" | "manager";
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = React.useState<SavedCheckIn | null>(
    session.checkIn,
  );
  const [isLocating, setIsLocating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [permissionOpen, setPermissionOpen] = React.useState(false);
  const [resultSuccess, setResultSuccess] =
    React.useState<CheckInResultSuccess | null>(null);
  const [resultFailure, setResultFailure] =
    React.useState<CheckInResultFailure | null>(null);
  const pendingCheckIn = React.useRef(false);

  const subject = session.subjectName ?? session.courseName;
  const classLine = [session.className, session.classCode, session.semester]
    .filter((value): value is string => Boolean(value))
    .join(" Â· ");
  const hasCheckInTime =
    checkIn?.status === "present" || checkIn?.status === "late";
  const checkInWindow = getSessionCheckInWindow(
    session.startsAt,
    session.endsAt,
  );
  const opensAt = checkInWindow
    ? new Date(checkInWindow.opensAt).toISOString()
    : session.startsAt;

  const checkInNow = async () => {
    if (isLocating || pendingCheckIn.current) {
      return;
    }

    const windowState = getSessionCheckInWindowState(
      session.startsAt,
      session.endsAt,
      Date.now(),
    );

    if (windowState !== "open") {
      setResultFailure({
        message:
          windowState === "before"
            ? "Check-in has not opened yet."
            : "Check-in for this session has closed.",
        distanceM: null,
        radiusM: null,
        canRetry: false,
      });
      return;
    }

    pendingCheckIn.current = true;
    setIsLocating(true);
    setError(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;
      const capturedAt = position.capturedAt;

      if (Date.now() - capturedAt > CHECKIN_POSITION_MAX_AGE_MS) {
        setResultFailure({
          message:
            "Your location is stale. Move somewhere with a clearer signal and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.",
          distanceM: null,
          radiusM: session.radiusM,
          canRetry: true,
        });
        setPermissionOpen(false);
        return;
      }

      if (accuracy > SESSION_CHECKIN_ACCURACY_MAX_M) {
        setResultFailure({
          message: `Your location is only accurate to about ${Math.round(accuracy)} m. Move somewhere with a clearer signal and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.`,
          distanceM: null,
          radiusM: session.radiusM,
          canRetry: true,
        });
        setPermissionOpen(false);
        return;
      }

      const response = await fetch(
        `/api/sessions/${session.sessionId}/checkin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude, accuracy, capturedAt }),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        data?: { checkIn?: SavedCheckIn & { alreadyCheckedIn?: boolean } };
        error?: { code?: string; message?: string };
      } | null;

      if (!response.ok) {
        const retryable =
          body?.error?.code !== "checkin_closed" &&
          body?.error?.code !== "checkin_unavailable";
        setResultFailure({
          message: describeCheckInFailure(
            body?.error?.code,
            body?.error?.message,
          ),
          distanceM: null,
          radiusM:
            body?.error?.code === "checkin_too_far" ? session.radiusM : null,
          canRetry: retryable,
        });
        setPermissionOpen(false);
        return;
      }

      const saved = body?.data?.checkIn;

      if (!saved) {
        setResultFailure({
          message:
            "The server did not confirm your check-in. Try again before leaving the meeting point.",
          distanceM: null,
          radiusM: null,
          canRetry: true,
        });
        setPermissionOpen(false);
        return;
      }

      setCheckIn({
        status: saved.status,
        checkedInAt: saved.checkedInAt,
        distanceM: saved.distanceM,
      });
      setPermissionOpen(false);
      setResultSuccess({
        status: saved.status,
        checkedInAt: saved.checkedInAt,
        distanceM: saved.distanceM,
        subjectName: subject,
        meetingNumber: session.title || "Session",
      });
      router.refresh();
    } catch (caught) {
      setResultFailure({
        message: describeGeolocationError(caught),
        distanceM: null,
        radiusM: null,
        canRetry: true,
      });
      setPermissionOpen(false);
    } finally {
      pendingCheckIn.current = false;
      setIsLocating(false);
    }
  };

  return (
    <article className="border-border bg-surface rounded-2xl border p-5 transition-colors hover:border-accent/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <BookOpen
            aria-hidden="true"
            className="h-5 w-5"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-snug font-semibold tracking-tight">
            {subject}
          </h3>
          {classLine ? (
            <p className="text-muted-foreground mt-0.5 text-sm">{classLine}</p>
          ) : null}
          {session.title && session.title !== subject ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {session.title}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-xs">
            <User
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {session.organizerName}
          </p>
        </div>

        <dl className="text-muted-foreground grid shrink-0 gap-1.5 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <CalendarDays
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <dt className="sr-only">Session date</dt>
            <dd>
              {formatSessionDate(session.startsAt, session.timeZone, {
                withWeekday: true,
              })}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <dt className="sr-only">Check-in window</dt>
            <dd>
              Check-in {formatSessionTime(opensAt, session.timeZone)}â€“
              {formatSessionTime(session.endsAt, session.timeZone)}{" "}
              {timeZoneLabel(session.timeZone)}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <dt className="sr-only">Allowed area</dt>
            <dd>
              {session.location ? `${session.location} Â· ` : ""}
              Within {session.radiusM} meters
            </dd>
          </div>
        </dl>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end sm:self-center">
          {mode === "manager" ? (
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <Badge variant="success">Open</Badge>
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <Link href={`/sessions/${session.sessionId}`}>
                  <Settings2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Manage
                </Link>
              </Button>
            </div>
          ) : checkIn ? (
            <>
              <div className="text-right">
                <Badge variant={STATUS_BADGE[checkIn.status]}>
                  {checkIn.status === "present" ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-3 w-3"
                    />
                  ) : null}
                  {ATTENDANCE_STATUS_LABELS[checkIn.status]}
                </Badge>
                {hasCheckInTime ? (
                  <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                    at{" "}
                    {formatSessionTime(checkIn.checkedInAt, session.timeZone)}{" "}
                    {timeZoneLabel(session.timeZone)}
                  </p>
                ) : null}
                {checkIn.distanceM !== null ? (
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    About {Math.round(checkIn.distanceM)} m from the room
                  </p>
                ) : null}
              </div>
              <Link
                href={`/sessions/${session.sessionId}`}
                aria-label="Open session details"
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-accent inline-flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <MoreHorizontal
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <Badge variant="success">Open</Badge>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setError(null);
                  setPermissionOpen(true);
                }}
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
                {isLocating ? "Getting location..." : "Check in"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {error ? (
          <Alert
            variant="error"
            className="mt-4"
          >
            {error}
          </Alert>
        ) : null}
      </div>

      {mode === "student" ? (
        <>
          <LocationPermissionDialog
            open={permissionOpen}
            isRequesting={isLocating}
            onCancel={() => setPermissionOpen(false)}
            onEnable={() => void checkInNow()}
          />
          <CheckInResultDialog
            success={resultSuccess}
            failure={resultFailure}
            onClose={() => {
              setResultSuccess(null);
              setResultFailure(null);
            }}
            onRetry={() => {
              setResultFailure(null);
              setPermissionOpen(true);
            }}
            isRetrying={isLocating}
          />
        </>
      ) : null}
    </article>
  );
}
