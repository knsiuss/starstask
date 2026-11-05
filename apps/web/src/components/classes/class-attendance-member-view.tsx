import { MapPin } from "lucide-react";
import Link from "next/link";

import { ActiveAttendanceSessionCard } from "@/components/attendance/active-attendance-session-card";
import { AttendanceBreakdown } from "@/components/attendance/attendance-breakdown";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import type { AttendanceTab } from "@/components/attendance/attendance-tabs";
import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";
import type { AttendanceCheckInView } from "@/lib/attendance/types";
import type { StudentAttendanceView } from "@/lib/db/attendance";
import { pluralize } from "@starstask/shared";

const RECENT_ENTRY_LIMIT = 4;

function NoActiveSessions() {
  return (
    <div className="border-border bg-surface rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="bg-accent-soft text-accent mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
        <MapPin
          aria-hidden="true"
          className="h-5 w-5"
        />
      </span>
      <p className="mt-3 text-sm font-medium">No open check-in right now</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
        A session appears here while its check-in window is open. Your class
        admin opens it when class starts.
      </p>
    </div>
  );
}

export function ClassAttendanceMemberView({
  view,
  checkInView,
  activeView,
  classSlug,
  classId,
  meetings,
  identity,
  selectedCourseId,
}: {
  view: StudentAttendanceView;
  checkInView: AttendanceCheckInView;
  activeView: AttendanceTab;
  classSlug: string;
  classId: string;
  meetings: StudentAttendanceMeeting[];
  identity: { fullName: string | null; nim: string | null };
  /** When set, every section below is limited to this course. */
  selectedCourseId: string | null;
}) {
  const base = `/app/classes/${classSlug}/attendance`;

  const scopedMeetings = selectedCourseId
    ? meetings.filter((meeting) => meeting.subjectId === selectedCourseId)
    : meetings;
  const scopedSessions = selectedCourseId
    ? checkInView.activeSessions.filter(
        (session) => session.subjectId === selectedCourseId,
      )
    : checkInView.activeSessions;
  const scopedEntries = selectedCourseId
    ? view.entries.filter((entry) => entry.subjectId === selectedCourseId)
    : view.entries;
  const scopedSubjects = selectedCourseId
    ? view.bySubject.filter((group) => group.key === selectedCourseId)
    : view.bySubject;
  const fullHistoryHref = selectedCourseId
    ? `/attendance?tab=history&class=${classId}&subject=${selectedCourseId}`
    : `/attendance?tab=history&class=${classId}`;

  if (activeView === "history") {
    return (
      <div className="grid gap-8">
        <AttendanceBreakdown
          title="By subject"
          description="Your sessions in this class."
          groups={scopedSubjects}
        />

        <section aria-labelledby="class-own-history">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2
                id="class-own-history"
                className="text-lg font-semibold tracking-tight"
              >
                Your history
              </h2>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {scopedEntries.length}{" "}
                {pluralize(scopedEntries.length, "session")}
              </span>
            </div>
            <Link
              href={fullHistoryHref}
              className="text-accent text-sm underline-offset-4 hover:underline"
            >
              Open full history
            </Link>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Only sessions that started after you joined this class are counted.
          </p>
          <div className="mt-3">
            <AttendanceHistory entries={scopedEntries} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <StudentMeetingList
        meetings={scopedMeetings}
        identity={identity}
      />

      <section aria-labelledby="class-active-sessions">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="class-active-sessions"
            className="text-lg font-semibold tracking-tight"
          >
            Active attendance sessions
          </h2>
          {scopedSessions.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {scopedSessions.length}{" "}
              {pluralize(scopedSessions.length, "session")} open
            </p>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Check in while the window is open. Your location is verified on the
          server.
        </p>

        <div className="mt-3 grid gap-3">
          {scopedSessions.length === 0 ? (
            <NoActiveSessions />
          ) : (
            scopedSessions.map((session) => (
              <ActiveAttendanceSessionCard
                key={session.sessionId}
                session={session}
              />
            ))
          )}
        </div>
      </section>

      <section aria-labelledby="class-recent-attendance">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2
              id="class-recent-attendance"
              className="text-lg font-semibold tracking-tight"
            >
              Recent attendance
            </h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
              {scopedEntries.length}{" "}
              {pluralize(scopedEntries.length, "session")}
            </span>
          </div>
          <Link
            href={`${base}?view=history`}
            className="text-accent text-sm underline-offset-4 hover:underline"
          >
            View history
          </Link>
        </div>

        <div className="mt-3">
          <AttendanceHistory
            entries={scopedEntries.slice(0, RECENT_ENTRY_LIMIT)}
          />
        </div>
      </section>
    </div>
  );
}
