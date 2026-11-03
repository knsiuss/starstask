import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CompletionToggle } from "@/components/assignments/completion-toggle";
import type { CalendarAssignmentBar } from "@/lib/db/calendar";
import { cn } from "@/lib/utils/cn";

import { courseColorFor } from "@/lib/schedule/course-colors";
import { toJakartaDateKey } from "@starstask/shared";

type UpcomingAssignmentsProps = {
  assignments: CalendarAssignmentBar[];
  limit?: number;
};

/**
 * The work that is still open, nearest deadline first. Completed assignments
 * stay visible with a distinct state so finishing one never makes it vanish.
 */
export function UpcomingAssignments({
  assignments,
  limit = 8,
}: UpcomingAssignmentsProps) {
  const visible = assignments.slice(0, limit);

  return (
    <section
      aria-labelledby="upcoming-assignments"
      className="border-border bg-surface overflow-hidden rounded-2xl border shadow-sm"
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <h2
            id="upcoming-assignments"
            className="text-base font-semibold tracking-tight"
          >
            Upcoming Assignments
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            From all your classes, sorted by nearest deadline.
          </p>
        </div>
        <Link
          href="/assignments?sort=deadline"
          className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          View all
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground px-5 py-8 text-center text-sm">
          Nothing matches the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-[11px] font-medium tracking-[0.06em] uppercase">
                <th
                  scope="col"
                  className="w-12 px-4 py-2.5"
                >
                  <span className="sr-only">Mark done</span>
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5"
                >
                  Title
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5"
                >
                  Course
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5"
                >
                  Start
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5"
                >
                  Deadline
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="w-16 px-4 py-2.5 text-right"
                >
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((assignment) => {
                const palette = courseColorFor(
                  assignment.courseKey ?? "unassigned",
                );
                const today = toJakartaDateKey(new Date());
                const isCompleted = assignment.isCompleted;
                const isOverdue = !isCompleted && assignment.endKey < today;

                return (
                  <tr
                    key={assignment.id}
                    className={cn(
                      "align-middle",
                      isCompleted && "bg-subtle/60",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <CompletionToggle
                        assignmentId={assignment.id}
                        completed={isCompleted}
                        title={assignment.title}
                      />
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <Link
                        href={assignment.href}
                        className="hover:text-accent line-clamp-1 font-medium"
                        title={assignment.title}
                      >
                        {assignment.title}
                      </Link>
                    </td>
                    <td className="max-w-[170px] px-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: palette.dot }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">
                            {assignment.courseName ?? "—"}
                          </span>
                          {assignment.courseCode ? (
                            <span className="text-muted-foreground block text-[10px] tabular-nums">
                              {assignment.courseCode}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5 text-xs tabular-nums">
                      {formatShortDate(assignment.startKey)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-xs font-medium tabular-nums",
                        isOverdue ? "text-danger" : "text-foreground",
                      )}
                    >
                      {formatShortDate(assignment.endKey)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        completed={isCompleted}
                        overdue={isOverdue}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={assignment.href}
                        aria-label={`Open ${assignment.title}`}
                        className="text-accent hover:bg-accent-soft focus-visible:outline-accent inline-flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  completed,
  overdue,
}: {
  completed: boolean;
  overdue: boolean;
}) {
  if (completed) {
    return (
      <span className="border-success/30 bg-success-soft text-success inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold">
        Completed
      </span>
    );
  }

  if (overdue) {
    return (
      <span className="border-danger/30 bg-danger-soft text-danger inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold">
        Past due
      </span>
    );
  }

  return (
    <span className="border-accent/25 bg-accent-soft text-accent inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold">
      Ongoing
    </span>
  );
}

function formatShortDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);

  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
}
