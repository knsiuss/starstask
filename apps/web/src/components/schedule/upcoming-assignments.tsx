import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CompletionToggle } from "@/components/assignments/completion-toggle";
import type { CalendarAssignmentBar } from "@/lib/db/calendar";
import { courseColorFor } from "@/lib/schedule/course-colors";
import { cn } from "@/lib/utils/cn";
import { toJakartaDateKey } from "@starstask/shared";

const TABLE_COLUMNS = [
  "Title",
  "Course",
  "Start",
  "Deadline",
  "Status",
] as const;

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
  const today = toJakartaDateKey(new Date());

  return (
    <section
      aria-labelledby="upcoming-assignments"
      className="border-border bg-surface overflow-hidden rounded-xl border"
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
          className="text-accent focus-visible:outline-accent inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline sm:min-h-0"
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
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-subtle text-muted-foreground border-border border-b text-left text-[11px] font-medium tracking-[0.06em] uppercase">
                  <th
                    scope="col"
                    className="w-12 px-4 py-2.5"
                  >
                    <span className="sr-only">Mark done</span>
                  </th>
                  {TABLE_COLUMNS.map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-3 py-2.5"
                    >
                      {label}
                    </th>
                  ))}
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
                  const isCompleted = assignment.isCompleted;
                  const isOverdue = !isCompleted && assignment.endKey < today;

                  return (
                    <tr
                      key={assignment.id}
                      className={cn(
                        "hover:bg-hover align-middle transition-colors",
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
                          className="hover:text-accent focus-visible:outline-accent line-clamp-1 rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
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
                              {assignment.courseName ?? "Unassigned"}
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
                          className="text-accent hover:bg-accent-soft focus-visible:outline-accent inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
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

          <ul className="divide-border divide-y md:hidden">
            {visible.map((assignment) => {
              const palette = courseColorFor(
                assignment.courseKey ?? "unassigned",
              );
              const isCompleted = assignment.isCompleted;
              const isOverdue = !isCompleted && assignment.endKey < today;

              return (
                <li
                  key={assignment.id}
                  className={cn("px-4 py-3.5", isCompleted && "bg-subtle/60")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={assignment.href}
                        className="hover:text-accent focus-visible:outline-accent block rounded-sm text-sm font-semibold break-words focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {assignment.title}
                      </Link>
                      <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: palette.dot }}
                        />
                        <span className="truncate">
                          {assignment.courseName ?? "Unassigned"}
                          {assignment.courseCode
                            ? ` · ${assignment.courseCode}`
                            : ""}
                        </span>
                      </p>
                    </div>
                    <CompletionToggle
                      assignmentId={assignment.id}
                      completed={isCompleted}
                      title={assignment.title}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        completed={isCompleted}
                        overdue={isOverdue}
                      />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatShortDate(assignment.startKey)} to{" "}
                        <span
                          className={cn(
                            "font-medium",
                            isOverdue ? "text-danger" : "text-foreground",
                          )}
                        >
                          {formatShortDate(assignment.endKey)}
                        </span>
                      </span>
                    </div>
                    <Link
                      href={assignment.href}
                      className="text-accent focus-visible:outline-accent inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
                    >
                      Open
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
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
  const style = completed
    ? "border-success/30 bg-success-soft text-success"
    : overdue
      ? "border-danger/30 bg-danger-soft text-danger"
      : "border-accent/25 bg-accent-soft text-accent";
  const label = completed ? "Completed" : overdue ? "Past due" : "Ongoing";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        style,
      )}
    >
      {label}
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
