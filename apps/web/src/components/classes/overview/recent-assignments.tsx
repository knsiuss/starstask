import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock3,
  FileText,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { OverviewAssignment } from "@/lib/db/class-overview";
import {
  formatDate,
  getDeadlineState,
  type DeadlineState,
} from "@starstask/shared";

type Props = {
  assignments: OverviewAssignment[];
  viewAllHref: string;
};

const STATE_META: Record<
  DeadlineState | "completed",
  { label: string; variant: "accent" | "warning" | "danger" | "success" }
> = {
  upcoming: { label: "Upcoming", variant: "accent" },
  due_today: { label: "Due Today", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
  none: { label: "No deadline", variant: "accent" },
  completed: { label: "Completed", variant: "success" },
};

/**
 * Official assignments of the class, newest first. "Completed" only appears
 * when the viewer personally ticked the assignment off; a passed deadline
 * alone never counts as completed.
 */
export function RecentAssignments({ assignments, viewAllHref }: Props) {
  return (
    <section
      aria-labelledby="recent-assignments"
      className="border-border bg-surface overflow-hidden rounded-xl border"
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5 sm:py-3.5">
        <h2
          id="recent-assignments"
          className="text-foreground inline-flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <ClipboardList
            aria-hidden="true"
            className="text-muted-foreground h-4.5 w-4.5"
          />
          Recent Assignments
        </h2>
        <Link
          href={viewAllHref}
          className="text-accent hover:text-accent-hover focus-visible:outline-accent inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0"
        >
          View all
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      {assignments.length === 0 ? (
        <p className="text-muted-foreground px-5 py-8 text-center text-sm">
          Nothing published yet.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {assignments.map((assignment) => {
            const state = assignment.completed
              ? "completed"
              : getDeadlineState(assignment.deadline);
            const meta = STATE_META[state];

            return (
              <li
                key={assignment.id}
                className="group hover:bg-hover relative flex flex-col gap-2.5 px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex"
                  >
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/assignments/${assignment.id}`}
                      className="group-hover:text-accent text-foreground focus-visible:outline-accent block rounded-sm text-sm font-semibold tracking-tight break-words after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {assignment.title}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      {assignment.course_code
                        ? `${assignment.course_code} · `
                        : ""}
                      {assignment.course_name} · published{" "}
                      {formatDate(
                        assignment.published_at ?? assignment.created_at,
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                  <Badge variant={meta.variant}>
                    {state === "completed" ? (
                      <CircleCheck
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                    ) : state === "overdue" ? (
                      <TriangleAlert
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                    ) : state === "due_today" ? (
                      <Clock3
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                    ) : null}
                    {meta.label}
                  </Badge>
                  {assignment.deadline ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
                      <CalendarDays
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                      {formatDate(assignment.deadline)}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
