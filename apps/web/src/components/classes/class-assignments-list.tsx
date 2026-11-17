import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/classes/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { AssignmentListItem } from "@/types/database";
import type { AssignmentStatus } from "@starstask/contracts";
import {
  APP_TIME_ZONE,
  APP_TIME_ZONE_LABEL,
  type DeadlineState,
  deadlineStateLabel,
  formatDate,
  formatSessionTime,
  getDeadlineState,
} from "@starstask/shared";

/**
 * `list_assignments` filters on `a.status = 'published'` and does not project
 * the column, so every row of this listing is published by that contract.
 */
const LISTING_STATUS: AssignmentStatus = "published";

type ClassAssignmentsListProps = {
  assignments: AssignmentListItem[];
};

/**
 * Desktop table and mobile card list for published class assignments.
 */
export function ClassAssignmentsList({
  assignments,
}: ClassAssignmentsListProps) {
  return (
    <>
      <div className="border-border bg-surface mt-4 hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Published assignments in this class
          </caption>
          <thead className="bg-subtle text-muted-foreground">
            <tr className="text-left text-xs font-medium tracking-wide uppercase">
              <th
                scope="col"
                className="w-[38%] px-4 py-2.5 font-medium"
              >
                Title
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 font-medium"
              >
                Subject
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 font-medium whitespace-nowrap"
              >
                Published
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 font-medium whitespace-nowrap"
              >
                Deadline
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 font-medium"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium whitespace-nowrap"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {assignments.map((assignment) => (
              <tr
                key={assignment.id}
                className="hover:bg-hover transition-colors"
              >
                <td className="px-4 py-3 align-middle">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="hover:text-accent focus-visible:outline-accent rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
                  >
                    {assignment.title}
                  </Link>
                </td>
                <td className="text-muted-foreground px-4 py-3 align-middle">
                  {courseLabel(assignment)}
                </td>
                <td className="text-muted-foreground px-4 py-3 align-middle whitespace-nowrap tabular-nums">
                  {formatDate(assignment.created_at)}
                </td>
                <td className="px-4 py-3 align-middle">
                  <ClassAssignmentDeadline deadline={assignment.deadline} />
                </td>
                <td className="px-4 py-3 align-middle">
                  <StatusBadge status={LISTING_STATUS} />
                </td>
                <td className="px-4 py-3 text-right align-middle">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="text-accent focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
                  >
                    Open
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border border-border bg-surface mt-4 divide-y rounded-xl border md:hidden">
        {assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/assignments/${assignment.id}`}
                  className="hover:text-accent focus-visible:outline-accent rounded-sm text-sm font-semibold break-words focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
                >
                  {assignment.title}
                </Link>
                <p className="text-muted-foreground mt-1 text-xs">
                  {courseLabel(assignment)}
                </p>
              </div>
              <StatusBadge
                status={LISTING_STATUS}
                className="shrink-0"
              />
            </div>

            <div className="border-border mt-3 flex items-end justify-between gap-3 border-t pt-3">
              <div className="min-w-0">
                <ClassAssignmentDeadline deadline={assignment.deadline} />
                <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
                  Published {formatDate(assignment.created_at)}
                </p>
              </div>
              <Button
                asChild
                variant="secondary"
                className="min-h-[44px] shrink-0"
              >
                <Link href={`/assignments/${assignment.id}`}>
                  Open
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

const DEADLINE_TEXT_STYLES: Record<DeadlineState, string> = {
  none: "text-muted-foreground",
  upcoming: "text-foreground",
  due_today: "text-warning",
  overdue: "text-danger",
};

/** Deadline states that deserve their own label line under the date. */
const EMPHASIZED_DEADLINE_STATES: DeadlineState[] = ["due_today", "overdue"];

/** Deadline rendered as a compact date line plus a time line. */
function ClassAssignmentDeadline({ deadline }: { deadline: string | null }) {
  const state = getDeadlineState(deadline);

  if (!deadline || state === "none") {
    return (
      <span className="text-muted-foreground text-xs">
        {deadlineStateLabel("none")}
      </span>
    );
  }

  return (
    <div className="leading-tight">
      <p
        className={cn(
          "text-sm font-medium whitespace-nowrap tabular-nums",
          DEADLINE_TEXT_STYLES[state],
        )}
      >
        {formatDate(deadline)}
      </p>
      <p className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
        {formatSessionTime(deadline, APP_TIME_ZONE)} {APP_TIME_ZONE_LABEL}
      </p>
      {EMPHASIZED_DEADLINE_STATES.includes(state) ? (
        <p
          className={cn(
            "mt-0.5 text-xs font-medium whitespace-nowrap",
            DEADLINE_TEXT_STYLES[state],
          )}
        >
          {deadlineStateLabel(state)}
        </p>
      ) : null}
    </div>
  );
}

type ClassEmptyNoticeProps = {
  icon: ReactNode;
  title: string;
  body: string;
  className?: string;
};

/** Compact empty-state notice for class assignment sections. */
export function ClassEmptyNotice({
  icon,
  title,
  body,
  className,
}: ClassEmptyNoticeProps) {
  return (
    <div
      className={cn(
        "border-border bg-subtle mt-4 flex items-center gap-3 rounded-xl border border-dashed px-4 py-5",
        className,
      )}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{body}</p>
      </div>
    </div>
  );
}

function courseLabel(assignment: AssignmentListItem): string {
  return assignment.course_code
    ? `${assignment.course_code} · ${assignment.course_name}`
    : assignment.course_name;
}
