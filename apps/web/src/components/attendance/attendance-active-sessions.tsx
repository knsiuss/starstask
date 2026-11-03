"use client";

import { Activity, Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import { APP_TIME_ZONE, formatSessionTime } from "@starstask/shared";

type AttendanceActiveSessionsProps = {
  meetings: AttendanceMeetingListItem[];
  onOpenSession: (meeting: AttendanceMeetingListItem) => void;
};

/**
 * Sessions whose check-in window is open right now.
 *
 * The list is derived from the class meetings, so an open session always
 * shows the counts the database reports for it.
 */
export function AttendanceActiveSessions({
  meetings,
  onOpenSession,
}: AttendanceActiveSessionsProps) {
  const open = meetings.filter((meeting) => meeting.phase === "open");

  return (
    <section
      aria-labelledby="attendance-active-sessions"
      className="border-border bg-surface rounded-2xl border p-5"
    >
      <header className="flex items-center gap-2.5">
        <span className="bg-success-soft text-success flex h-9 w-9 items-center justify-center rounded-lg">
          <Activity
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>
        <div className="min-w-0">
          <h2
            id="attendance-active-sessions"
            className="text-sm font-semibold tracking-tight"
          >
            Active sessions
          </h2>
          <p className="text-muted-foreground text-xs">
            Sessions currently open for check-in.
          </p>
        </div>
        {open.length > 0 ? (
          <Badge
            variant="success"
            className="ml-auto"
          >
            {open.length} open
          </Badge>
        ) : null}
      </header>

      {open.length === 0 ? (
        <div className="border-border bg-subtle mt-4 rounded-xl border border-dashed px-5 py-10 text-center">
          <Activity
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <p className="mt-2 text-sm font-medium">No active session</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Open a session above to start recording attendance.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {open.map((meeting) => (
            <li
              key={meeting.sessionId}
              className="border-border rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {meeting.subjectName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Pertemuan {meeting.meetingNumber}
                  </p>
                </div>
                <Badge variant="success">Open</Badge>
              </div>

              <dl className="text-muted-foreground mt-3 space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <dt className="sr-only">Check-in window</dt>
                  <dd>
                    {formatSessionTime(meeting.startsAt, APP_TIME_ZONE)}–
                    {formatSessionTime(meeting.endsAt, APP_TIME_ZONE)}
                  </dd>
                </div>

                {meeting.location ? (
                  <div className="flex items-center gap-1.5">
                    <MapPin
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <dt className="sr-only">Location</dt>
                    <dd className="truncate">{meeting.location}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs tabular-nums">
                  {meeting.counts.present} / {meeting.counts.expected} present
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpenSession(meeting)}
                >
                  Monitor
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
