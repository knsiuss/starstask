import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClassAttendanceSession } from "@/lib/db/class-attendance";
import {
  formatSessionDate,
  formatSessionTime,
  formatAttendancePercentage,
} from "@starstask/shared";

export function ClassAttendanceSessions({
  sessions,
  limit = 8,
}: {
  sessions: ClassAttendanceSession[];
  limit?: number;
}) {
  if (sessions.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-8 text-center text-sm">
        No sessions have started yet. Attendance appears after the first one.
      </div>
    );
  }

  const visible = sessions.slice(0, limit);

  return (
    <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
      {visible.map((session) => {
        const pending = session.counts.pending > 0;

        return (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.title}</p>
              <p className="text-muted-foreground text-xs">
                {session.subjectName ?? "No linked subject"} ·{" "}
                {formatSessionDate(session.startsAt, session.timeZone)} ·{" "}
                {formatSessionTime(session.startsAt, session.timeZone)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={pending ? "neutral" : "success"}>
                {pending ? "Pending" : "Finished"}
              </Badge>
              <span className="text-muted-foreground text-xs tabular-nums">
                {session.counts.attended}/{session.counts.eligible} attended ·{" "}
                {formatAttendancePercentage(session.counts.percentage)}
              </span>
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <Link href={`/sessions/${session.id}`}>
                  {pending ? "Record" : "Correct"}
                </Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
