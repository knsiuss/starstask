"use client";

import { ChevronRight, Loader2, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requestOpenAttendanceMeeting } from "@/features/attendance-meetings/client-actions";
import {
  ATTENDANCE_HISTORY_PAGE_SIZE,
  filterAttendanceMeetings,
  paginateAttendanceHistory,
} from "@/lib/attendance/meeting-history";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import {
  ATTENDANCE_MEETING_PHASE_LABELS,
  ATTENDANCE_MEETING_PHASES,
  type AttendanceMeetingPhase,
} from "@starstask/contracts";
import {
  APP_TIME_ZONE,
  formatSessionDate,
  formatSessionTime,
} from "@starstask/shared";

const PHASE_BADGE: Record<AttendanceMeetingPhase, BadgeProps["variant"]> = {
  scheduled: "neutral",
  open: "success",
  closed: "warning",
  finalized: "accent",
};

type SubjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type ClassAttendanceHistoryTableProps = {
  classSlug: string;
  meetings: AttendanceMeetingListItem[];
  subjects: SubjectOption[];
  onOpenSession: (meeting: AttendanceMeetingListItem) => void;
};

/**
 * The session history of the class.
 *
 * Every row is a real meeting of the class with the counts the database
 * reports for it. Filtering and paging happen over that list, so the table
 * never makes the page longer.
 */
export function ClassAttendanceHistoryTable({
  classSlug,
  meetings,
  subjects,
  onOpenSession,
}: ClassAttendanceHistoryTableProps) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState("all");
  const [phase, setPhase] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () =>
      filterAttendanceMeetings(meetings, {
        subjectId: subjectId === "all" ? null : subjectId,
        phase: phase === "all" ? null : (phase as AttendanceMeetingPhase),
      }),
    [meetings, phase, subjectId],
  );

  const paged = React.useMemo(
    () => paginateAttendanceHistory(filtered, page),
    [filtered, page],
  );

  const openMeeting = async (meeting: AttendanceMeetingListItem) => {
    if (openingId) {
      return;
    }

    setOpeningId(meeting.sessionId);
    setError(null);

    const result = await requestOpenAttendanceMeeting(
      classSlug,
      meeting.sessionId,
    );

    setOpeningId(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.refresh();
  };

  return (
    <section
      aria-labelledby="attendance-history"
      className="border-border bg-surface flex min-h-0 flex-col rounded-2xl border p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-lg">
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <div className="min-w-0">
            <h2
              id="attendance-history"
              className="text-sm font-semibold tracking-tight"
            >
              Session history
            </h2>
            <p className="text-muted-foreground text-xs">
              Every attendance session of this class.
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {filtered.length} {filtered.length === 1 ? "session" : "sessions"}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="attendance-history-course"
            className="text-xs"
          >
            Course
          </Label>
          <Select
            id="attendance-history-course"
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value);
              setPage(1);
            }}
            className="w-56"
          >
            <option value="all">All courses</option>
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
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="attendance-history-status"
            className="text-xs"
          >
            Status
          </Label>
          <Select
            id="attendance-history-status"
            value={phase}
            onChange={(event) => {
              setPhase(event.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="all">All statuses</option>
            {ATTENDANCE_MEETING_PHASES.map((value) => (
              <option
                key={value}
                value={value}
              >
                {ATTENDANCE_MEETING_PHASE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-danger mt-3 text-xs"
        >
          {error}
        </p>
      ) : null}

      <div className="border-border mt-4 min-h-0 flex-1 overflow-auto rounded-xl border">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-border text-muted-foreground sticky top-0 z-10 border-b bg-surface text-left text-xs">
              <th
                scope="col"
                className="px-4 py-2 font-medium"
              >
                #
              </th>
              <th
                scope="col"
                className="px-4 py-2 font-medium"
              >
                Course
              </th>
              <th
                scope="col"
                className="px-4 py-2 font-medium"
              >
                Date
              </th>
              <th
                scope="col"
                className="px-4 py-2 font-medium"
              >
                Time
              </th>
              <th
                scope="col"
                className="px-4 py-2 font-medium"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-right font-medium"
              >
                Attendance
              </th>
              <th
                scope="col"
                className="w-14 px-4 py-2"
              >
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-border divide-y">
            {paged.items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground px-4 py-8 text-center text-xs"
                >
                  {meetings.length === 0
                    ? "No attendance session has been created for this class yet."
                    : "No session matches these filters."}
                </td>
              </tr>
            ) : (
              paged.items.map((meeting) => (
                <tr
                  key={meeting.sessionId}
                  className="hover:bg-subtle"
                >
                  <td className="text-muted-foreground px-4 py-2.5 tabular-nums">
                    {meeting.meetingNumber}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{meeting.subjectName}</span>
                    {meeting.subjectCode ? (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {meeting.subjectCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    {formatSessionDate(meeting.startsAt, APP_TIME_ZONE, {
                      withWeekday: true,
                    })}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs tabular-nums">
                    {formatSessionTime(meeting.startsAt, APP_TIME_ZONE)}–
                    {formatSessionTime(meeting.endsAt, APP_TIME_ZONE)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={PHASE_BADGE[meeting.phase]}>
                      {ATTENDANCE_MEETING_PHASE_LABELS[meeting.phase]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {meeting.counts.present} / {meeting.counts.expected}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {meeting.phase === "scheduled" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void openMeeting(meeting)}
                        disabled={openingId !== null}
                      >
                        {openingId === meeting.sessionId ? (
                          <Loader2
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-spin"
                          />
                        ) : (
                          <PlayCircle
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        )}
                        Open
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenSession(meeting)}
                        aria-label={`Open session ${meeting.meetingNumber}`}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paged.totalPages > 1 ? (
        <nav
          aria-label="Attendance history pages"
          className="mt-3 flex items-center justify-between gap-3 text-xs"
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={paged.page <= 1}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {paged.page} of {paged.totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setPage((current) => Math.min(paged.totalPages, current + 1))
            }
            disabled={paged.page >= paged.totalPages}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
