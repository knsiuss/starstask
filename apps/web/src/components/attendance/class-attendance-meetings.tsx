"use client";

import {
  CalendarDays,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AttendanceMeetingForm } from "@/components/attendance/attendance-meeting-form";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import {
  ATTENDANCE_MEETING_PHASE_LABELS,
  type AttendanceMeetingPhase,
} from "@starstask/contracts";
import { formatSessionDate, formatSessionTime } from "@starstask/shared";

const TIME_ZONE = "Asia/Jakarta";

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

type ClassAttendanceMeetingsProps = {
  classId: string;
  classSlug: string;
  subjects: SubjectOption[];
  meetings: AttendanceMeetingListItem[];
};

/**
 * Manager view of the attendance meetings for one class. Every action is
 * re-authorized by the server; this component only decides what to show.
 */
export function ClassAttendanceMeetings({
  classId,
  classSlug,
  subjects,
  meetings,
}: ClassAttendanceMeetingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const [exportSubjectId, setExportSubjectId] = React.useState(
    subjects[0]?.id ?? "",
  );
  const [pendingMeetingId, setPendingMeetingId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const base = `/app/classes/${classSlug}/attendance`;
  const apiBase = `/api/classes/${classSlug}/attendance`;
  const openCount = meetings.filter(
    (meeting) => meeting.phase === "open",
  ).length;

  const openMeeting = async (sessionId: string) => {
    if (pendingMeetingId) {
      return;
    }

    setPendingMeetingId(sessionId);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/meetings/${sessionId}/open`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not open attendance.");
        return;
      }

      toast({
        variant: "success",
        title: "Attendance opened",
        description: "Students can now check in from their Attendance page.",
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPendingMeetingId(null);
    }
  };

  return (
    <section aria-labelledby="attendance-meetings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="attendance-meetings"
              className="text-lg font-semibold tracking-tight"
            >
              Attendance meetings
            </h2>
            {openCount > 0 ? (
              <Badge variant="success">{openCount} open</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            One record per student per meeting. Create a meeting, open it when
            the class starts, then finalize it to write explicit absences for
            members who never checked in.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setIsCreating((current) => !current)}
          aria-expanded={isCreating}
        >
          <PlusCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
          {isCreating ? "Hide form" : "New meeting"}
        </Button>
      </div>

      {isCreating ? (
        <AttendanceMeetingForm
          classId={classId}
          classSlug={classSlug}
          subjects={subjects}
          onDone={() => setIsCreating(false)}
        />
      ) : null}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        {subjects.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="attendance-export-subject"
                className="text-xs"
              >
                Semester exports
              </Label>
              <Select
                id="attendance-export-subject"
                value={exportSubjectId}
                onChange={(event) => setExportSubjectId(event.target.value)}
                className="w-64"
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
            </div>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <a
                href={`/api/classes/${classSlug}/attendance/exports/recap?subjectId=${exportSubjectId}`}
              >
                <Download
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Recap .xlsx
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              title="Used by the StarsTask SIS autofill extension; your session cookies stay in the browser"
            >
              <a
                href={`/api/classes/${classSlug}/attendance/recap-json?subjectId=${exportSubjectId}`}
              >
                <Download
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Recap JSON
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <a
                href={`/api/classes/${classSlug}/attendance/exports/checklist?subjectId=${exportSubjectId}`}
              >
                <FileSpreadsheet
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Blank checklist .xlsx
              </a>
            </Button>
          </div>
        ) : null}
        <p className="text-muted-foreground ml-auto text-xs">
          {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
        </p>
      </div>

      {meetings.length === 0 ? (
        <div className="border-border bg-subtle mt-4 rounded-xl border border-dashed px-5 py-10 text-center">
          <CalendarDays
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <p className="mt-2 text-sm font-medium">No attendance meetings yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Create the first meeting to start recording attendance per meeting.
          </p>
        </div>
      ) : (
        <ul className="border-border divide-border mt-4 divide-y rounded-xl border">
          {meetings.map((meeting) => (
            <li
              key={meeting.sessionId}
              className="hover:bg-muted/40 flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <Link
                href={`${base}/meetings/${meeting.sessionId}`}
                className="focus-visible:outline-accent min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      Pertemuan {meeting.meetingNumber}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {meeting.subjectCode ? `${meeting.subjectCode} · ` : ""}
                      {meeting.subjectName}
                    </span>
                    <Badge variant={PHASE_BADGE[meeting.phase]}>
                      {ATTENDANCE_MEETING_PHASE_LABELS[meeting.phase]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatSessionDate(meeting.startsAt, TIME_ZONE, {
                      withWeekday: true,
                    })}{" "}
                    · {formatSessionTime(meeting.startsAt, TIME_ZONE)}–
                    {formatSessionTime(meeting.endsAt, TIME_ZONE)}
                    {meeting.location ? ` · ${meeting.location}` : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {meeting.counts.expected} expected ·{" "}
                    {meeting.counts.present} present · {meeting.counts.late}{" "}
                    late · {meeting.counts.absent} absent ·{" "}
                    {meeting.counts.notRecorded} not recorded
                    {meeting.counts.failed > 0
                      ? ` · ${meeting.counts.failed} failed attempts`
                      : ""}
                  </p>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                {meeting.phase === "scheduled" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void openMeeting(meeting.sessionId)}
                    disabled={pendingMeetingId !== null}
                  >
                    {pendingMeetingId === meeting.sessionId ? (
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
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          <p className="text-xs leading-relaxed">{error}</p>
        </Alert>
      ) : null}
    </section>
  );
}
