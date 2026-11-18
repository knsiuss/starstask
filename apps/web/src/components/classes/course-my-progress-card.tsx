import { ArrowUpRight, Award, CheckCircle2, ClipboardList } from "lucide-react";
import Link from "next/link";

import { formatAttendancePercentage } from "@starstask/shared";

type CourseMyProgressCardProps = {
  courseId: string;
  assignmentsHref: string;
  attendancePercentage: number | null;
  attendedSessions: number;
  eligibleSessions: number;
  pendingAssignmentsCount: number;
  tugas: number | null;
  uts: number | null;
  uas: number | null;
};

function formatScore(score: number | null): string {
  if (score === null) {
    return "-";
  }

  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * Compact student progress strip for a course: attendance rate, pending
 * assignments, and Tugas / UTS / UAS scores in one scannable band.
 */
export function CourseMyProgressCard({
  courseId,
  assignmentsHref,
  attendancePercentage,
  attendedSessions,
  eligibleSessions,
  pendingAssignmentsCount,
  tugas,
  uts,
  uas,
}: CourseMyProgressCardProps) {
  return (
    <section
      aria-label="Your course progress"
      className="border-border bg-surface rounded-xl border p-4 sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
        <Link
          href={`/attendance/courses/${courseId}`}
          className="group flex min-h-[44px] items-center justify-between gap-3 sm:pr-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">
                My attendance
              </p>
              <p className="text-foreground mt-0.5 text-base font-semibold tabular-nums">
                {formatAttendancePercentage(attendancePercentage)}
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                  {eligibleSessions > 0
                    ? `${attendedSessions}/${eligibleSessions}`
                    : "no sessions"}
                </span>
              </p>
            </div>
          </div>
          <ArrowUpRight
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>

        <Link
          href={assignmentsHref}
          className="group flex min-h-[44px] items-center justify-between gap-3 border-t border-border pt-3 sm:border-t-0 sm:px-4 sm:pt-0"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <ClipboardList
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">
                Pending tasks
              </p>
              <p className="text-foreground mt-0.5 text-base font-semibold tabular-nums">
                {pendingAssignmentsCount}
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                  {pendingAssignmentsCount === 1 ? "upcoming" : "upcoming"}
                </span>
              </p>
            </div>
          </div>
          <ArrowUpRight
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>

        <div className="flex min-h-[44px] items-center gap-3 border-t border-border pt-3 sm:border-t-0 sm:pl-4 sm:pt-0">
          <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Award
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-medium">
              Grades (Tugas / UTS / UAS)
            </p>
            <p className="text-foreground mt-0.5 flex items-center gap-2 text-sm font-semibold tabular-nums">
              <span>{formatScore(tugas)}</span>
              <span className="text-muted-foreground font-normal">/</span>
              <span>{formatScore(uts)}</span>
              <span className="text-muted-foreground font-normal">/</span>
              <span>{formatScore(uas)}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
