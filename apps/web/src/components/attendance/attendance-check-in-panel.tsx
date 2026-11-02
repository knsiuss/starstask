import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { ActiveAttendanceSessionCard } from "@/components/attendance/active-attendance-session-card";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import type { ActiveAttendanceSession } from "@/lib/attendance/types";
import type { AttendanceEntry } from "@/lib/db/attendance";

export function AttendanceCheckInPanel({
  sessions,
  recentEntries,
}: {
  sessions: ActiveAttendanceSession[];
  recentEntries: AttendanceEntry[];
}) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="active-attendance-sessions">
        <h2
          id="active-attendance-sessions"
          className="text-lg font-semibold tracking-tight"
        >
          Active attendance sessions
        </h2>

        {sessions.length === 0 ? (
          <div className="border-border bg-subtle mt-4 rounded-xl border border-dashed px-5 py-10 text-center">
            <CalendarDays
              aria-hidden="true"
              className="text-muted-foreground mx-auto h-6 w-6"
            />
            <p className="mt-2 text-sm font-medium">
              No active attendance sessions
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
              Your class admin has not opened attendance yet.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {sessions.map((session) => (
              <li key={session.sessionId}>
                <ActiveAttendanceSessionCard session={session} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentEntries.length > 0 ? (
        <section aria-labelledby="recent-attendance">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="recent-attendance"
              className="text-lg font-semibold tracking-tight"
            >
              Recent attendance
            </h2>
            <Link
              href="/attendance?tab=history"
              className="text-accent text-sm underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="mt-3">
            <AttendanceHistory entries={recentEntries} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
