import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { StatusBadge } from "@/components/classes/status-badge";
import type { ClassSummary } from "@/lib/db/classes";
import type { MyClassSubmission } from "@/lib/db/class-submissions";
import type { AssignmentListItem } from "@/types/database";
import { formatDate } from "@starstask/shared";

type ClassOverviewProps = {
  classSummary: ClassSummary;
  recentAssignments: AssignmentListItem[];
  submissions: MyClassSubmission[];
  canManage: boolean;
};

export function ClassOverview({
  classSummary,
  recentAssignments,
  submissions,
  canManage,
}: ClassOverviewProps) {
  const base = `/dashboard/classes/${classSummary.slug}`;

  return (
    <div className="mt-6 space-y-6">
      <section
        aria-labelledby="recent-assignments"
        className="border-border bg-surface overflow-hidden rounded-xl border"
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-5 py-4">
          <h2
            id="recent-assignments"
            className="text-base font-semibold tracking-tight"
          >
            Recent assignments
          </h2>
          <Link
            href={`${base}?tab=assignments`}
            className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            View all
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        </div>

        {recentAssignments.length === 0 ? (
          <p className="text-muted-foreground px-5 py-6 text-center text-sm">
            Nothing published yet.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {recentAssignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="hover:text-accent text-sm font-medium hover:underline"
                  >
                    {assignment.title}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {assignment.course_code
                      ? `${assignment.course_code} · `
                      : ""}
                    {assignment.course_name} · published{" "}
                    {formatDate(assignment.created_at)}
                  </p>
                </div>
                <DeadlineBadge deadline={assignment.deadline} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="my-class-activity"
        className="border-border bg-surface overflow-hidden rounded-xl border"
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-5 py-4">
          <h2
            id="my-class-activity"
            className="text-base font-semibold tracking-tight"
          >
            {canManage ? "Your posts" : "Your submissions"}
          </h2>
          <Link
            href={`${base}?tab=assignments#my-submissions`}
            className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            View all
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        </div>

        {submissions.length === 0 ? (
          <p className="text-muted-foreground px-5 py-6 text-center text-sm">
            {canManage ? "No posts yet." : "Nothing submitted yet."}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{submission.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Revision {submission.revision} · updated{" "}
                    {formatDate(submission.updated_at)}
                  </p>
                  {submission.status === "rejected" &&
                  submission.rejection_reason ? (
                    <p className="text-danger mt-1 text-xs">
                      {submission.rejection_reason}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={submission.status} />
                  {submission.status === "published" ? (
                    <Link
                      href={`/assignments/${submission.id}`}
                      className="text-accent text-xs font-medium hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                  {submission.status === "rejected" ? (
                    <Link
                      href={`${base}/submissions/${submission.id}/revise`}
                      className="text-accent text-xs font-medium hover:underline"
                    >
                      Revise
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
