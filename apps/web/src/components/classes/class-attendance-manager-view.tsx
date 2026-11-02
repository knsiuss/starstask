import { MapPin } from "lucide-react";
import Link from "next/link";

import { ActiveAttendanceSessionCard } from "@/components/attendance/active-attendance-session-card";
import { AttendanceBreakdown } from "@/components/attendance/attendance-breakdown";
import { ClassAttendanceMeetings } from "@/components/attendance/class-attendance-meetings";
import { ClassAttendanceMembers } from "@/components/attendance/class-attendance-members";
import { ClassAttendanceSessions } from "@/components/attendance/class-attendance-sessions";
import type { AttendanceTab } from "@/components/attendance/attendance-tabs";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import type { AttendanceCheckInView } from "@/lib/attendance/types";
import type { ClassAttendanceView } from "@/lib/db/class-attendance";
import { pluralize } from "@starstask/shared";

function NoOpenSessions() {
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
        Create a meeting above, then open attendance when class starts. Students
        can check in from their Attendance page while the window is open.
      </p>
    </div>
  );
}

export function ClassAttendanceManagerView({
  view,
  checkInView,
  activeView,
  classSlug,
  classId,
  meetings,
  subjects,
}: {
  view: ClassAttendanceView;
  checkInView: AttendanceCheckInView;
  activeView: AttendanceTab;
  classSlug: string;
  classId: string;
  meetings: AttendanceMeetingListItem[];
  subjects: { id: string; name: string; code: string | null }[];
}) {
  const base = `/dashboard/classes/${classSlug}`;
  const historyHref = `${base}?tab=attendance&view=history`;

  if (activeView === "history") {
    return (
      <div className="grid gap-8">
        <AttendanceBreakdown
          title="By subject"
          description="Aggregated across members and sessions."
          groups={view.bySubject}
        />

        <section aria-labelledby="class-session-attendance">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2
                id="class-session-attendance"
                className="text-lg font-semibold tracking-tight"
              >
                Session attendance
              </h2>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {view.sessions.length}{" "}
                {pluralize(view.sessions.length, "session")}
              </span>
            </div>
            <Link
              href={`${base}/sessions`}
              className="text-accent text-sm underline-offset-4 hover:underline"
            >
              Manage sessions
            </Link>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Record or correct a session on its own page. A missing record is
            never counted as present.
          </p>
          <div className="mt-3">
            <ClassAttendanceSessions
              sessions={view.sessions}
              limit={8}
            />
          </div>
        </section>

        <section aria-labelledby="class-member-attendance">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2
                id="class-member-attendance"
                className="text-lg font-semibold tracking-tight"
              >
                Member attendance
              </h2>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {view.members.length} {pluralize(view.members.length, "member")}
              </span>
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Only class admins can record or correct attendance.
          </p>
          <div className="mt-3">
            <ClassAttendanceMembers members={view.members} />
          </div>
        </section>
      </div>
    );
  }

  const sessions = checkInView.activeSessions;

  return (
    <div className="grid gap-8">
      <ClassAttendanceMeetings
        classId={classId}
        classSlug={classSlug}
        subjects={subjects}
        meetings={meetings}
      />

      <section aria-labelledby="class-active-sessions">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="class-active-sessions"
            className="text-lg font-semibold tracking-tight"
          >
            Active attendance sessions
          </h2>
          {sessions.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {sessions.length} {pluralize(sessions.length, "session")} open
            </p>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Open a session to record attendance. Members can check in while the
          window is open.
        </p>

        <div className="mt-3 grid gap-3">
          {sessions.length === 0 ? (
            <NoOpenSessions />
          ) : (
            sessions.map((session) => (
              <ActiveAttendanceSessionCard
                key={session.sessionId}
                session={session}
                mode="manager"
              />
            ))
          )}
        </div>
      </section>

      <section aria-labelledby="class-recent-sessions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2
              id="class-recent-sessions"
              className="text-lg font-semibold tracking-tight"
            >
              Recent sessions
            </h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
              {view.sessions.length}{" "}
              {pluralize(view.sessions.length, "session")}
            </span>
          </div>
          <Link
            href={historyHref}
            className="text-accent text-sm underline-offset-4 hover:underline"
          >
            View history
          </Link>
        </div>

        <div className="mt-3">
          <ClassAttendanceSessions
            sessions={view.sessions}
            limit={4}
          />
        </div>
      </section>
    </div>
  );
}
