import { ChevronRight, Layers } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  COURSE_ATTENDANCE_STATUS_LABELS,
  type ClassCourseRow,
  type CourseAttendanceStatus,
} from "@/lib/attendance/course-rows";
import { cn } from "@/lib/utils/cn";
import { formatAttendancePercentage, pluralize } from "@starstask/shared";

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

function progressWidth(row: ClassCourseRow): string {
  return row.counts.percentage === null
    ? "0%"
    : `${Math.min(100, row.counts.percentage)}%`;
}

function CourseStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground truncate text-[11px]">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

type ClassAttendanceCoursesProps = {
  rows: ClassCourseRow[];
  /** Where a course's own attendance screen lives. */
  hrefFor: (row: ClassCourseRow) => string;
  selectedCourseId: string | null;
  /** "sessions" for a student's own records, "meetings" for stored class meetings. */
  sessionNoun: string;
  emptyDescription: string;
};

/**
 * Per-course attendance cards for one class.
 *
 * Each card is scoped to a single course, so the percentage never mixes
 * attendance from other courses of the same class. The class-wide figure stays
 * in its own card in the sidebar.
 */
export function ClassAttendanceCourses({
  rows,
  hrefFor,
  selectedCourseId,
  sessionNoun,
  emptyDescription,
}: ClassAttendanceCoursesProps) {
  if (rows.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-xl border border-dashed px-5 py-10 text-center">
        <Layers
          aria-hidden="true"
          className="text-muted-foreground mx-auto h-6 w-6"
        />
        <p className="mt-2 text-sm font-medium">No courses yet</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => {
        const isSelected = row.subjectId === selectedCourseId;

        return (
          <li key={row.subjectId}>
            <Link
              href={hrefFor(row)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "border-border bg-surface hover:bg-subtle focus-visible:outline-accent flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isSelected && "border-accent ring-accent/30 ring-1",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {row.code ? (
                    <p className="text-muted-foreground text-xs font-medium">
                      {row.code}
                    </p>
                  ) : null}
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                </div>
                <p className="shrink-0 text-lg leading-none font-semibold tabular-nums">
                  {formatAttendancePercentage(row.counts.percentage)}
                </p>
              </div>

              <div
                role="presentation"
                className="bg-muted h-1.5 overflow-hidden rounded-full"
              >
                <div
                  className="bg-accent h-full rounded-full"
                  style={{ width: progressWidth(row) }}
                />
              </div>

              <dl className="grid grid-cols-3 gap-2">
                <CourseStat
                  label="Present"
                  value={row.counts.present}
                />
                <CourseStat
                  label="Late"
                  value={row.counts.late}
                />
                <CourseStat
                  label="Absent"
                  value={row.counts.absent + row.counts.unrecorded}
                />
              </dl>

              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[row.status]}>
                    {COURSE_ATTENDANCE_STATUS_LABELS[row.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {row.sessionCount}{" "}
                    {pluralize(row.sessionCount, sessionNoun)}
                  </span>
                </span>
                <span className="text-accent inline-flex items-center gap-1 text-xs font-medium">
                  View attendance
                  <ChevronRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
