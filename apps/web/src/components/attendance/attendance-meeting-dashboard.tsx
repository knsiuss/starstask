"use client";

import {
  CalendarDays,
  Clock,
  Download,
  Loader2,
  Lock,
  MapPin,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AttendanceMeetingLocationForm } from "@/components/attendance/attendance-meeting-location-form";
import { AttendanceMeetingTable } from "@/components/attendance/attendance-meeting-table";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type {
  AttendanceMeetingDetail,
  AttendanceMeetingFailureOutcome,
} from "@/lib/attendance/meeting-types";
import {
  ATTENDANCE_MEETING_PHASE_LABELS,
  type AttendanceMeetingPhase,
} from "@starstask/contracts";
import {
  formatSessionDate,
  formatSessionTime,
  timeZoneLabel,
} from "@starstask/shared";

const TIME_ZONE = "Asia/Jakarta";
const POLL_INTERVAL_MS = 20_000;

const PHASE_BADGE: Record<AttendanceMeetingPhase, BadgeProps["variant"]> = {
  scheduled: "neutral",
  open: "success",
  closed: "warning",
  finalized: "accent",
};

const FAILURE_LABELS: Record<AttendanceMeetingFailureOutcome, string> = {
  name_mismatch: "Name did not match the profile",
  nim_mismatch: "NIM did not match the profile",
  identity_missing: "Profile is missing a name or NIM",
  outside_radius: "Outside the allowed radius",
  imprecise: "GPS accuracy was insufficient",
  closed: "Arrived after attendance closed",
  not_open: "Tried before attendance opened",
  not_available: "Not eligible for this meeting",
};

type AttendanceMeetingDashboardProps = {
  classSlug: string;
  initialDetail: AttendanceMeetingDetail;
  /** Lets a host (e.g. the attendance workspace panel) drop the top margin. */
  className?: string;
};

function summaryTime(value: string | null, fallback: string): string {
  return formatSessionTime(value ?? fallback, TIME_ZONE);
}

/**
 * Live manager dashboard for one meeting. Counts and the roster come from the
 * server; polling only refreshes them, and every button is re-authorized.
 */
export function AttendanceMeetingDashboard({
  classSlug,
  initialDetail,
  className,
}: AttendanceMeetingDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [detail, setDetail] = React.useState(initialDetail);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [isChangingLocation, setIsChangingLocation] = React.useState(false);
  const [finalizeOpen, setFinalizeOpen] = React.useState(false);
  const pendingRef = React.useRef<string | null>(null);
  const refreshSeqRef = React.useRef(0);
  const isOpen = detail.phase === "open";

  // Server re-renders (e.g. router.refresh after a location change) pass
  // fresh props; without this the client state would keep showing stale data.
  const [prevInitialDetail, setPrevInitialDetail] = React.useState(initialDetail);

  if (initialDetail !== prevInitialDetail) {
    setPrevInitialDetail(initialDetail);
    setDetail(initialDetail);
  }

  React.useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const exportHref = `/api/classes/${classSlug}/attendance/exports/meeting/${detail.sessionId}`;

  const refresh = React.useCallback(async () => {
    const seq = (refreshSeqRef.current += 1);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings/${detail.sessionId}`,
        { cache: "no-store" },
      );

      if (seq !== refreshSeqRef.current) {
        return;
      }

      if (!response.ok) {
        setRefreshError("Live update failed — showing the last known data.");
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        data?: AttendanceMeetingDetail;
      } | null;

      if (seq !== refreshSeqRef.current) {
        return;
      }

      if (body?.data) {
        setDetail(body.data);
        setRefreshError(null);
      }
    } catch {
      if (seq === refreshSeqRef.current) {
        setRefreshError("Live update failed — showing the last known data.");
      }
    }
  }, [classSlug, detail.sessionId]);

  const shouldPoll = detail.phase === "open" || detail.phase === "scheduled";

  React.useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!pendingRef.current) {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (!pendingRef.current && document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [shouldPoll, refresh]);

  const run = async (
    action: "open" | "close" | "reopen",
    body?: Record<string, unknown>,
    label?: string,
  ) => {
    if (pending) {
      return;
    }

    setPending(action);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/attendance/meetings/${detail.sessionId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        data?: { absencesCreated?: number };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not update attendance.");
        return;
      }

      const created = payload?.data?.absencesCreated ?? 0;

      toast({
        variant: "success",
        title: label ?? "Attendance updated",
        description:
          action === "close" && body?.finalize
            ? `${created} absence${created === 1 ? "" : "s"} recorded.`
            : undefined,
      });
      setFinalizeOpen(false);
      await refresh();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const counts = detail.counts;

  return (
    <div className={className ?? "mt-6"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {detail.subjectName} · Pertemuan {detail.meetingNumber}
            </h2>
            <Badge variant={PHASE_BADGE[detail.phase]}>
              {ATTENDANCE_MEETING_PHASE_LABELS[detail.phase]}
            </Badge>
            {isOpen ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                <RefreshCw
                  aria-hidden="true"
                  className="h-3 w-3"
                />
                Live, refreshes every 20 seconds
              </span>
            ) : null}
          </div>
          <dl className="text-muted-foreground mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Meeting date</dt>
              <dd>
                {formatSessionDate(detail.startsAt, TIME_ZONE, {
                  withWeekday: true,
                })}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Meeting time</dt>
              <dd>
                {formatSessionTime(detail.startsAt, TIME_ZONE)}–
                {formatSessionTime(detail.endsAt, TIME_ZONE)}{" "}
                {timeZoneLabel(TIME_ZONE)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Check-in window</dt>
              <dd>
                Check-in {summaryTime(detail.opensAt, detail.startsAt)}–
                {summaryTime(detail.closesAt, detail.endsAt)} · late after{" "}
                {detail.lateAfterMinutes} minutes
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Location</dt>
              <dd>
                {detail.location ?? "No location name"} · {detail.radiusM} m
                radius
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {detail.phase === "scheduled" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void run("open", undefined, "Attendance opened")}
              disabled={pending !== null}
            >
              {pending === "open" ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <PlayCircle
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
              Open attendance
            </Button>
          ) : null}

          {isOpen ? (
            <>
              <Dialog
                open={finalizeOpen}
                onOpenChange={setFinalizeOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending !== null}
                  >
                    <Lock
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Close and finalize
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Close and finalize attendance?</DialogTitle>
                  <DialogDescription>
                    Every eligible member without a record is written as absent.
                    Reopening removes only those automatic absences, so a manual
                    correction is never discarded.
                  </DialogDescription>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        void run(
                          "close",
                          { finalize: true },
                          "Attendance finalized",
                        )
                      }
                      disabled={pending !== null}
                    >
                      {pending === "close" ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : (
                        <Lock
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      )}
                      Finalize
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setFinalizeOpen(false)}
                      disabled={pending !== null}
                    >
                      Cancel
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void run("close", { finalize: false }, "Attendance closed")
                }
                disabled={pending !== null}
              >
                Close only
              </Button>
            </>
          ) : null}

          {detail.phase !== "open" && detail.phase !== "scheduled" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                void run("reopen", undefined, "Attendance reopened")
              }
              disabled={pending !== null}
            >
              {pending === "reopen" ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <RotateCcw
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
              Reopen
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setIsChangingLocation((current) => !current)}
            aria-expanded={isChangingLocation}
          >
            <MapPin
              aria-hidden="true"
              className="h-4 w-4"
            />
            Location
          </Button>

          <Button
            asChild
            size="sm"
            variant="secondary"
          >
            <a href={exportHref}>
              <Download
                aria-hidden="true"
                className="h-4 w-4"
              />
              Meeting .xlsx
            </a>
          </Button>
        </div>
      </div>

      {isChangingLocation ? (
        <AttendanceMeetingLocationForm
          classSlug={classSlug}
          sessionId={detail.sessionId}
          currentRadiusM={detail.radiusM}
          onDone={() => {
            setIsChangingLocation(false);
            void refresh();
          }}
        />
      ) : null}

      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="text-xs leading-relaxed">{error}</p>
        </Alert>
      ) : null}

      {refreshError ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          <p className="text-xs leading-relaxed">{refreshError}</p>
        </Alert>
      ) : null}

      <dl className="border-border mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Registered"
          value={counts.expected}
        />
        <Stat
          label="Present"
          value={counts.present}
          tone="success"
        />
        <Stat
          label="Late"
          value={counts.late}
          tone="warning"
        />
        <Stat
          label="Absent"
          value={counts.absent}
          tone="danger"
        />
        <Stat
          label="Not recorded"
          value={counts.notRecorded}
        />
        <Stat
          label="Failed attempts"
          value={counts.failed}
        />
      </dl>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users
              aria-hidden="true"
              className="h-4 w-4"
            />
            Master roster
          </h3>
          <p className="text-muted-foreground text-xs">
            Active members, sorted by full name then NIM. Includes students who
            never checked in.
          </p>
        </div>
        <div className="mt-3">
          <AttendanceMeetingTable
            roster={detail.roster}
            classSlug={classSlug}
            sessionId={detail.sessionId}
            onCorrected={() => void refresh()}
          />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">Failed verification attempts</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          The server stores the outcome, measured distance, and GPS accuracy
          only. The typed name and NIM are never stored.
        </p>
        {detail.failures.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">
            No failed attempts recorded.
          </p>
        ) : (
          <ul className="border-border divide-border mt-3 divide-y rounded-xl border text-xs">
            {detail.failures.slice(0, 25).map((failure, index) => (
              <li
                key={`${failure.userId}-${failure.createdAt}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="font-medium">{failure.displayName}</span>
                <span className="text-muted-foreground">
                  {FAILURE_LABELS[failure.outcome]}
                  {failure.distanceM !== null
                    ? ` · ${Math.round(failure.distanceM)} m away`
                    : ""}
                  {failure.accuracyM !== null
                    ? ` · ±${Math.round(failure.accuracyM)} m`
                    : ""}
                  {" · "}
                  {formatSessionTime(failure.createdAt, TIME_ZONE)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {detail.failures.length > 25 ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Showing the 25 most recent attempts · {detail.failures.length - 25}{" "}
            older attempts are not listed.
          </p>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        A meeting that is open is never auto-marked absent. Finalizing writes an
        explicit absence only for eligible members without a record. Corrections
        are made on the session page and audited.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd
        className={
          tone === "success"
            ? "text-success mt-0.5 text-lg font-semibold tabular-nums"
            : tone === "warning"
              ? "text-warning mt-0.5 text-lg font-semibold tabular-nums"
              : tone === "danger"
                ? "text-danger mt-0.5 text-lg font-semibold tabular-nums"
                : "mt-0.5 text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
