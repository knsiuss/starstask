import { ChevronRight, Layers } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  COURSE_ATTENDANCE_STATUS_LABELS,
  type CourseAttendanceRow,
  type CourseAttendanceStatus,
} from "@/lib/attendance/course-rows";
import { formatAttendancePercentage } from "@starstask/shared";

const STATUS_VARIANTS: Record<
  CourseAttendanceStatus,
  "neutral" | "accent" | "warning" | "success" | "danger"
> = {
  excellent: "success",
  good: "accent",
  fair: "warning",
  at_risk: "danger",
  no_sessions: "neutral",
};

function courseHref(row: CourseAttendanceRow): string | null {
  return row.subjectId ? `/attendance/courses/${row.subjectId}` : null;
}

function CourseIdentity({ row }: { row: CourseAttendanceRow }) {
  return (
    <div className="min-w-0">
      {row.code ? (
        <p className="text-muted-foreground text-xs font-medium">{row.code}</p>
      ) : null}
      <p className="truncate text-sm font-medium">{row.name}</p>
      <p className="text-muted-foreground truncate text-xs">{row.className}</p>
    </div>
  );
}

function CourseStatus({ row }: { row: CourseAttendanceRow }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">
          {formatAttendancePercentage(row.counts.percentage)}
        </p>
        <Badge
          variant={STATUS_VARIANTS[row.status]}
          className="mt-1"
        >
          {COURSE_ATTENDANCE_STATUS_LABELS[row.status]}
        </Badge>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="text-muted-foreground h-4 w-4"
      />
    </div>
  );
}

/** Compact table on desktop, stacked cards on mobile. */
export function CourseAttendanceTable({
  rows,
}: {
  rows: CourseAttendanceRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-xl border border-dashed px-5 py-10 text-center">
        <Layers
          aria-hidden="true"
          className="text-muted-foreground mx-auto h-6 w-6"
        />
        <p className="mt-2 text-sm font-medium">No courses yet</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
          Courses appear here once you join a class that has subjects.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="border-border text-muted-foreground hidden border-b px-4 py-2 text-xs font-medium sm:grid sm:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,0.6fr))_minmax(0,1.1fr)] sm:gap-3">
        <span>Course</span>
        <span className="text-center">Sessions</span>
        <span className="text-center">Present</span>
        <span className="text-center">Absent</span>
        <span className="text-right">Percentage</span>
      </div>

      <ul className="divide-border divide-y">
        {rows.map((row) => {
          const href = courseHref(row);
          const content = (
            <>
              <CourseIdentity row={row} />

              <span className="hidden text-center text-sm tabular-nums sm:block">
                {row.counts.eligible}
              </span>
              <span className="text-muted-foreground hidden text-center text-sm tabular-nums sm:block">
                {row.counts.present}
              </span>
              <span className="text-muted-foreground hidden text-center text-sm tabular-nums sm:block">
                {row.counts.absent + row.counts.unrecorded}
              </span>

              <div className="flex items-center justify-between gap-3 sm:hidden">
                <p className="text-muted-foreground text-xs">
                  {row.counts.eligible} sessions ·{" "}
                  {row.counts.present + row.counts.late} attended
                </p>
                <CourseStatus row={row} />
              </div>

              <div className="hidden sm:block">
                <CourseStatus row={row} />
              </div>
            </>
          );

          return (
            <li key={row.key}>
              {href ? (
                <Link
                  href={href}
                  className="group hover:bg-subtle flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,0.6fr))_minmax(0,1.1fr)] sm:items-center sm:gap-3"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,0.6fr))_minmax(0,1.1fr)] sm:items-center sm:gap-3">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
