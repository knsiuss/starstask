"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  LocateFixed,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckInResultDialog,
  type CheckInResultFailure,
  type CheckInResultSuccess,
} from "@/components/attendance/check-in-result-dialog";
import { LocationPermissionDialog } from "@/components/attendance/location-permission-dialog";
import { PendingSyncNote } from "@/components/attendance/pending-sync-note";
import { describeCheckInFailure } from "@/lib/attendance/check-in-errors";
import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";
import type { AttendanceCheckInStatus } from "@/lib/attendance/types";
import { enqueue, list as listOutbox } from "@/lib/offline/checkin-outbox";
import {
  describeGeolocationError,
  getCurrentPosition,
} from "@/lib/geo/position";
import {
  ATTENDANCE_MEETING_PHASE_LABELS,
  ATTENDANCE_MEETING_NIM_PATTERN,
  ATTENDANCE_STATUS_LABELS,
  CHECKIN_POSITION_MAX_AGE_MS,
  SESSION_CHECKIN_ACCURACY_MAX_M,
} from "@starstask/contracts";
import {
  formatSessionDate,
  formatSessionTime,
  timeZoneLabel,
} from "@starstask/shared";

const TIME_ZONE = "Asia/Jakarta";

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

export function StudentMeetingList({
  meetings,
  identity,
  heading = "Attendance meetings",
}: {
  meetings: StudentAttendanceMeeting[];
  identity: { fullName: string | null; nim: string | null };
  heading?: string;
}) {
  if (meetings.length === 0) {
    return (
      <section aria-labelledby="student-attendance-meetings">
        <h2
          id="student-attendance-meetings"
          className="text-lg font-semibold tracking-tight"
        >
          {heading}
        </h2>
        <div className="border-border bg-subtle mt-4 rounded-xl border border-dashed px-5 py-10 text-center">
          <CalendarDays
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <p className="mt-2 text-sm font-medium">
            No open or upcoming meetings
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Your class admin creates each meeting. It appears here when
            attendance is open or the meeting is coming up.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="student-attendance-meetings">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="student-attendance-meetings"
          className="text-lg font-semibold tracking-tight"
        >
          {heading}
        </h2>
        <p className="text-muted-foreground text-xs">
          {meetings.filter((meeting) => meeting.phase === "open").length} open
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {meetings.map((meeting) => (
          <li key={meeting.sessionId}>
            <StudentMeetingCard
              meeting={meeting}
              identity={identity}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudentMeetingCard({
  meeting,
  identity,
}: {
  meeting: StudentAttendanceMeeting;
  identity: { fullName: string | null; nim: string | null };
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState(identity.fullName ?? "");
  const [nim, setNim] = React.useState(identity.nim ?? "");
  const [checkIn, setCheckIn] = React.useState(meeting.checkIn);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [permissionOpen, setPermissionOpen] = React.useState(false);
  const [resultSuccess, setResultSuccess] =
    React.useState<CheckInResultSuccess | null>(null);
  const [resultFailure, setResultFailure] =
    React.useState<CheckInResultFailure | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    fullName?: string;
    nim?: string;
  }>({});
  const [pendingSync, setPendingSync] = React.useState(false);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const pendingCheckIn = React.useRef(false);
  const router = useRouter();

  const identityReady = Boolean(identity.fullName && identity.nim);
  const hasCheckInTime = checkIn !== null;
  const isOpenPhase = meeting.phase === "open";

  React.useEffect(() => {
    let cancelled = false;

    const reconcileAsync = async () => {
      try {
        const entries = await listOutbox();

        if (cancelled) {
          return;
        }

        const mine = entries.filter(
          (entry) =>
            entry.kind === "attendance-meeting" &&
            entry.sessionId === meeting.sessionId,
        );

        const latest = mine[mine.length - 1];

        if (!latest) {
          return;
        }

        if (latest.status === "sent" && latest.serverStatus) {
          const serverStatus = latest.serverStatus;

          setPendingSync(false);
          setSessionExpired(false);
          setCheckIn((current) => ({
            status: serverStatus,
            checkedInAt: new Date(latest.createdAt).toISOString(),
            distanceM: current?.distanceM ?? null,
          }));
          return;
        }

        if (latest.status === "failed") {
          setPendingSync(false);
          setResultFailure({
            message: describeCheckInFailure(
              latest.lastError ?? undefined,
              undefined,
            ),
            distanceM: null,
            radiusM: meeting.radiusM,
            canRetry: false,
          });
          return;
        }

        if (latest.status === "pending_sync" || latest.status === "syncing") {
          setPendingSync(true);
          setSessionExpired(latest.lastError === "http_401");
        }
      } catch (error) {
        console.error("[offline] could not read the outbox", {
          name: error instanceof Error ? error.name : typeof error,
        });
      }
    };

    void reconcileAsync();

    const handleOnline = () => {
      void reconcileAsync();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [meeting.sessionId, meeting.radiusM]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy || pendingCheckIn.current) {
      return;
    }

    const nextFieldErrors: typeof fieldErrors = {};

    if (fullName.trim().length < 2) {
      nextFieldErrors.fullName = "Enter your full name.";
    }

    if (!ATTENDANCE_MEETING_NIM_PATTERN.test(nim.trim())) {
      nextFieldErrors.nim = "Enter a valid NIM.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setError(null);
    setPermissionOpen(true);
  };

  const runCheckIn = async () => {
    if (isBusy || pendingCheckIn.current) {
      return;
    }

    pendingCheckIn.current = true;
    setIsBusy(true);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;
      const capturedAt = position.capturedAt;

      if (Date.now() - capturedAt > CHECKIN_POSITION_MAX_AGE_MS) {
        setResultFailure({
          message:
            "Your location is stale. Move somewhere with a clearer signal and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.",
          distanceM: null,
          radiusM: meeting.radiusM,
          canRetry: isOpenPhase,
        });
        setPermissionOpen(false);
        return;
      }

      if (
        !Number.isFinite(accuracy) ||
        accuracy > SESSION_CHECKIN_ACCURACY_MAX_M
      ) {
        setResultFailure({
          message: `Your GPS signal is not accurate enough (about ${Math.round(accuracy)} m). Move to an area with a clearer signal and try again. If you are in the room, ask your class admin to mark you present manually — they must physically verify you first.`,
          distanceM: null,
          radiusM: meeting.radiusM,
          canRetry: isOpenPhase,
        });
        setPermissionOpen(false);
        return;
      }

      const offline = typeof navigator !== "undefined" && !navigator.onLine;

      let response: Response | null = null;

      try {
        if (offline) {
          // Skip the fetch entirely: the browser would throw a TypeError
          // anyway, and we want the enqueue path to be deterministic.
          response = null;
        } else {
          response = await fetch(
            `/api/attendance/meetings/${meeting.sessionId}/checkin`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // capturedAt is audit metadata for the server path's existing
              // freshness check; the outbox replay omits it (L1).
              body: JSON.stringify({
                fullName: fullName.trim(),
                nim: nim.trim(),
                latitude,
                longitude,
                accuracy,
                capturedAt,
              }),
            },
          );
        }
      } catch (fetchError) {
        // Network-layer failure (TypeError): queue the tap instead of
        // surfacing an error. `capturedAt` stays inside the outbox record.
        if (!(fetchError instanceof TypeError)) {
          throw fetchError;
        }

        response = null;
      }

      if (response === null) {
        try {
          await enqueue("attendance-meeting", meeting.sessionId, {
            fullName: fullName.trim(),
            nim: nim.trim(),
            latitude,
            longitude,
            accuracy,
          });
          setPendingSync(true);
          setSessionExpired(false);
          setIsOpen(false);
          setPermissionOpen(false);
        } catch (enqueueError) {
          console.error("[offline] could not enqueue the check-in", {
            name:
              enqueueError instanceof Error
                ? enqueueError.name
                : typeof enqueueError,
          });
          setResultFailure({
            message:
              "Tidak bisa menyimpan check-in di perangkat ini. Coba lagi saat online.",
            distanceM: null,
            radiusM: null,
            canRetry: isOpenPhase,
          });
          setPermissionOpen(false);
        }

        return;
      }

      const body = (await response.json().catch(() => null)) as {
        data?: {
          status?: AttendanceCheckInStatus;
          checkedInAt?: string;
          distanceM?: number | null;
        };
        error?: {
          code?: string;
          message?: string;
          fieldErrors?: Record<string, string>;
        };
      } | null;

      if (!response.ok) {
        const nextErrors: typeof fieldErrors = {};

        if (body?.error?.fieldErrors?.fullName) {
          nextErrors.fullName = body.error.fieldErrors.fullName;
        }

        if (body?.error?.fieldErrors?.nim) {
          nextErrors.nim = body.error.fieldErrors.nim;
        }

        if (Object.keys(nextErrors).length > 0) {
          setFieldErrors(nextErrors);
        }

        const code = body?.error?.code;
        const retryable =
          code !== "checkin_closed" && code !== "checkin_unavailable";

        setResultFailure({
          message: describeCheckInFailure(code, body?.error?.message),
          distanceM: null,
          radiusM: code === "checkin_too_far" ? meeting.radiusM : null,
          canRetry: retryable && isOpenPhase,
        });
        setPermissionOpen(false);
        return;
      }

      const saved = body?.data;

      if (
        saved?.status !== "present" &&
        saved?.status !== "late" &&
        saved?.status !== "excused" &&
        saved?.status !== "absent"
      ) {
        setResultFailure({
          message:
            "The server did not confirm your check-in. Try again before leaving the meeting point.",
          distanceM: null,
          radiusM: null,
          canRetry: isOpenPhase,
        });
        setPermissionOpen(false);
        return;
      }

      setCheckIn({
        status: saved.status,
        checkedInAt: saved.checkedInAt ?? new Date().toISOString(),
        distanceM: saved.distanceM ?? null,
      });
      setIsOpen(false);
      setPermissionOpen(false);
      setResultSuccess({
        status: saved.status,
        checkedInAt: saved.checkedInAt ?? new Date().toISOString(),
        distanceM: saved.distanceM ?? null,
        subjectName: meeting.subjectName,
        meetingNumber: meeting.meetingNumber,
      });
      router.refresh();
    } catch (caught) {
      const message = describeGeolocationError(caught);
      setResultFailure({
        message,
        distanceM: null,
        radiusM: null,
        canRetry: isOpenPhase,
      });
      setPermissionOpen(false);
    } finally {
      pendingCheckIn.current = false;
      setIsBusy(false);
    }
  };

  return (
    <article className="border-border bg-surface rounded-2xl border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <CalendarDays
            aria-hidden="true"
            className="h-5 w-5"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg leading-snug font-semibold tracking-tight">
              {meeting.subjectName}
            </h3>
            <Badge variant={isOpenPhase ? "success" : "neutral"}>
              {ATTENDANCE_MEETING_PHASE_LABELS[meeting.phase]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Pertemuan {meeting.meetingNumber} · {meeting.className}
            {meeting.classCode ? ` (${meeting.classCode})` : ""}
          </p>

          <dl className="text-muted-foreground mt-3 grid gap-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Meeting date</dt>
              <dd>
                {formatSessionDate(meeting.startsAt, TIME_ZONE, {
                  withWeekday: true,
                })}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Meeting time</dt>
              <dd>
                {formatSessionTime(meeting.startsAt, TIME_ZONE)}–
                {formatSessionTime(meeting.endsAt, TIME_ZONE)}{" "}
                {timeZoneLabel(TIME_ZONE)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Deadline</dt>
              <dd>
                Check-in closes{" "}
                {formatSessionTime(
                  meeting.closesAt ?? meeting.endsAt,
                  TIME_ZONE,
                )}{" "}
                {timeZoneLabel(TIME_ZONE)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Location</dt>
              <dd>
                {meeting.location ? `${meeting.location} · ` : ""}
                Within {meeting.radiusM} m
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:self-center">
          {pendingSync ? (
            <div className="max-w-[14rem] text-right">
              <Badge variant="warning">Menunggu sinkron</Badge>
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                Tersimpan di perangkat. Akan dikirim saat online.
              </p>
            </div>
          ) : checkIn ? (
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
                  at {formatSessionTime(checkIn.checkedInAt, TIME_ZONE)}{" "}
                  {timeZoneLabel(TIME_ZONE)}
                </p>
              ) : null}
              {checkIn.distanceM !== null ? (
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  About {Math.round(checkIn.distanceM)} m from the meeting point
                </p>
              ) : null}
              {isOpenPhase ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setError(null);
                    setIsOpen((current) => !current);
                  }}
                  aria-expanded={isOpen}
                >
                  {isOpen ? "Hide check-in" : "Check in again"}
                </Button>
              ) : null}
            </div>
          ) : isOpenPhase && identityReady ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setError(null);
                setIsOpen((current) => !current);
              }}
              aria-expanded={isOpen}
            >
              {isOpen ? "Hide check-in" : "Check In"}
            </Button>
          ) : !identityReady ? (
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href="/settings/profile">Complete profile</Link>
            </Button>
          ) : (
            <div className="max-w-[14rem] text-right">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled
              >
                <MapPin
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Check In
              </Button>
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                Your class admin opens check-in when the class starts.
              </p>
            </div>
          )}
        </div>
      </div>

      {!identityReady ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          <p className="text-xs leading-relaxed">
            Add your full name and NIM in your profile before checking in. The
            server rejects a name or NIM that does not match your verified
            profile.
          </p>
        </Alert>
      ) : null}

      {pendingSync ? <PendingSyncNote className="mt-4" /> : null}

      {sessionExpired ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          <p className="text-xs leading-relaxed">
            Sesi kamu berakhir. Masuk lagi untuk menyinkronkan absen yang
            menunggu.
          </p>
        </Alert>
      ) : null}

      {isOpen && isOpenPhase ? (
        <form
          onSubmit={submit}
          className="border-border mt-4 space-y-4 border-t pt-4"
        >
          <div>
            <p className="text-sm font-medium">Confirm your identity</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The server checks these values against your verified profile. It
              also checks the meeting window, your membership, GPS accuracy, and
              the allowed radius before writing a record. When you confirm, your
              browser asks for location permission.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`meeting-name-${meeting.sessionId}`}>
                Full name
              </Label>
              <Input
                id={`meeting-name-${meeting.sessionId}`}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.fullName)}
              />
              {fieldErrors.fullName ? (
                <p className="text-danger text-xs">{fieldErrors.fullName}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`meeting-nim-${meeting.sessionId}`}>NIM</Label>
              <Input
                id={`meeting-nim-${meeting.sessionId}`}
                value={nim}
                onChange={(event) => setNim(event.target.value)}
                autoComplete="username"
                aria-invalid={Boolean(fieldErrors.nim)}
              />
              {fieldErrors.nim ? (
                <p className="text-danger text-xs">{fieldErrors.nim}</p>
              ) : null}
            </div>
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
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                  Checking location…
                </>
              ) : (
                <>
                  <LocateFixed
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Confirm and check in
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsOpen(false);
                setError(null);
              }}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>

          <p className="text-muted-foreground text-[11px] leading-relaxed">
            GPS confirms your distance from the meeting point; it cannot prove
            who is holding the phone. Your full name and NIM must match your
            verified profile.
          </p>
        </form>
      ) : null}

      <LocationPermissionDialog
        open={permissionOpen}
        isRequesting={isBusy}
        onCancel={() => setPermissionOpen(false)}
        onEnable={() => void runCheckIn()}
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
          setIsOpen(true);
          setPermissionOpen(true);
        }}
        isRetrying={isBusy}
      />
    </article>
  );
}
