import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Clock3, CircleCheck, TriangleAlert } from "lucide-react";
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
 * when the viewer personally ticked the assignment off — a passed deadline
 * alone never counts as completed.
 */
export function RecentAssignments({ assignments, viewAllHref }: Props) {
  return (
    <section
      aria-labelledby="recent-assignments"
      className="border-border bg-surface overflow-hidden rounded-xl border"
    >
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <h2
          id="recent-assignments"
          className="text-accent inline-flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <ClipboardList
            aria-hidden="true"
            className="h-5 w-5"
          />
          Recent Assignments
        </h2>
        <Link
          href={viewAllHref}
          className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-semibold transition-colors"
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
                className="hover:bg-band/50 flex items-start gap-3 px-5 py-4 transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="bg-accent-soft text-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                >
                  <FileText className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="hover:text-accent text-foreground block truncate text-sm font-semibold tracking-tight focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {assignment.title}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {assignment.course_code
                      ? `${assignment.course_code} · `
                      : ""}
                    {assignment.course_name} · published{" "}
                    {formatDate(
                      assignment.published_at ?? assignment.created_at,
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
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
