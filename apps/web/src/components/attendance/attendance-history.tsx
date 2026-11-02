import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge";
import type { AttendanceEntry } from "@/lib/db/attendance";
import { SESSION_TYPE_LABELS } from "@starstask/contracts";
import { formatSessionDate, formatSessionTime } from "@starstask/shared";

export function AttendanceHistory({ entries }: { entries: AttendanceEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-10 text-center">
        <p className="text-sm font-medium">No attendance records match</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
          Finished sessions appear here once they happen. Try widening the
          filters if you expected older records.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="border-border text-muted-foreground hidden border-b px-4 py-2 text-xs font-medium sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] sm:gap-4">
        <span>Session</span>
        <span>Date and check-in</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="divide-border divide-y">
        {entries.map((entry) => (
          <li key={entry.sessionId}>
            <Link
              href={`/attendance/${entry.sessionId}`}
              className="group hover:bg-subtle flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {entry.className} · {entry.subjectName ?? "No linked subject"}{" "}
                  · {SESSION_TYPE_LABELS[entry.sessionType]}
                </p>
              </div>

              <div className="sm:block">
                <p className="text-sm">
                  {formatSessionDate(entry.startsAt, entry.timeZone)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatSessionTime(entry.startsAt, entry.timeZone)}
                  {entry.checkedInAt
                    ? ` · checked in ${formatSessionTime(entry.checkedInAt, entry.timeZone)}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <AttendanceStatusBadge status={entry.status} />
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 transition group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
