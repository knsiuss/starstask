import { CalendarDays, ChevronRight, FileText, Paperclip } from "lucide-react";
import Link from "next/link";

import { AssignmentRowMenu } from "@/components/classes/assignment-row-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MyClassSubmission } from "@/lib/db/class-submissions";
import type { CourseAssignmentSummary } from "@/lib/db/classes";
import type { AssignmentStatusRow } from "@/types/database";
import { formatDate, formatTimeRemaining } from "@starstask/shared";

const SUBMISSION_STATUS_LABELS: Record<AssignmentStatusRow, string> = {
  draft: "Draft",
  pending_review: "In review",
  pending: "In review",
  published: "Published",
  rejected: "Needs revision",
  unpublished: "Unpublished",
  archived: "Archived",
};

type CourseAssignmentRowProps = {
  assignment: CourseAssignmentSummary;
  classSlug: string;
  completed: boolean;
  now: Date;
  canManage: boolean;
};

/**
 * Single assignment row in the course Assignments list.
 *
 * Shows deadline and status on both mobile and desktop viewports while
 * keeping the row clickable via a stretched link beneath the action menu.
 */
export function CourseAssignmentRow({
  assignment,
  classSlug,
  completed,
  now,
  canManage,
}: CourseAssignmentRowProps) {
  const isClosed =
    assignment.deadline !== null &&
    new Date(assignment.deadline).getTime() < now.getTime();
  const timeRemaining = formatTimeRemaining(assignment.deadline, now);
  const statusBadge = isClosed ? (
    <Badge variant="neutral">Closed</Badge>
  ) : completed ? (
    <Badge variant="success">Done</Badge>
  ) : (
    <Badge variant="accent">Open</Badge>
  );

  return (
    <li className="group hover:bg-hover relative transition-colors">
      <div className="flex items-start gap-3.5 px-4 py-4 sm:items-center sm:gap-4 sm:px-5">
        <span className="bg-muted text-muted-foreground hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex">
          <FileText
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <div className="min-w-0 flex-1">
          {/* The title link stretches over the whole row; the "..." menu sits
              above it with a higher stacking order so it stays clickable. */}
          <Link
            href={`/assignments/${assignment.id}`}
            className="focus-visible:outline-accent text-[15px] font-semibold tracking-tight break-words underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
          >
            {assignment.title}
          </Link>

          {assignment.description ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
              {assignment.description}
            </p>
          ) : null}

          <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Published{" "}
              {formatDate(assignment.published_at ?? assignment.created_at)}
            </span>
            {assignment.source_label ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{assignment.source_label}</span>
              </>
            ) : null}
            {assignment.attachment_count > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Paperclip
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  {assignment.attachment_count}{" "}
                  {assignment.attachment_count === 1 ? "file" : "files"}
                </span>
              </>
            ) : null}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:hidden">
            {statusBadge}
            {assignment.deadline ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
                <CalendarDays
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Due {formatDate(assignment.deadline)}
                {timeRemaining ? ` · ${timeRemaining}` : " · Overdue"}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">No deadline</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-x-4">
          <div className="hidden sm:block">{statusBadge}</div>

          <div className="border-border hidden min-w-[140px] border-l pl-4 sm:block">
            {assignment.deadline ? (
              <>
                <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                  <CalendarDays
                    aria-hidden="true"
                    className="text-muted-foreground h-4 w-4 shrink-0"
                  />
                  Due {formatDate(assignment.deadline)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {timeRemaining || "Overdue"}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No deadline</p>
            )}
          </div>

          {canManage ? (
            <AssignmentRowMenu
              assignmentId={assignment.id}
              assignmentTitle={assignment.title}
              classSlug={classSlug}
            />
          ) : (
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5 sm:mt-0"
            />
          )}
        </div>
      </div>
    </li>
  );
}

type CourseSubmissionListProps = {
  submissions: MyClassSubmission[];
  courseName: string;
};

/** Viewer's own submissions for this course, with review status. */
export function CourseSubmissionList({
  submissions,
  courseName,
}: CourseSubmissionListProps) {
  if (submissions.length === 0) {
    return (
      <CourseAssignmentEmptyState
        title="Nothing submitted in this course"
        help={`Your own submissions in ${courseName} appear here with their review status.`}
      />
    );
  }

  return (
    <ul className="border-border bg-surface divide-border mt-5 divide-y overflow-hidden rounded-xl border">
      {submissions.map((submission) => (
        <li
          key={submission.id}
          className="group hover:bg-hover relative px-4 py-4 transition-colors sm:px-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/assignments/${submission.id}`}
                  className="focus-visible:outline-accent text-sm font-semibold break-words underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
                >
                  {submission.title}
                </Link>
                <Badge variant={submissionStatusVariant(submission.status)}>
                  {SUBMISSION_STATUS_LABELS[submission.status]}
                </Badge>
              </div>
              {submission.rejection_reason ? (
                <p className="text-danger mt-1 text-xs">
                  {submission.rejection_reason}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
                Submitted {formatDate(submission.created_at)}
                {submission.deadline
                  ? ` · Due ${formatDate(submission.deadline)}`
                  : ""}
                {submission.revision > 1
                  ? ` · Revision ${submission.revision}`
                  : ""}
              </p>
            </div>
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

type CourseAssignmentEmptyStateProps = {
  title: string;
  help: string;
  actionHref?: string;
  actionLabel?: string;
};

/** Empty state for course assignments and filtered/search views. */
export function CourseAssignmentEmptyState({
  title,
  help,
  actionHref,
  actionLabel,
}: CourseAssignmentEmptyStateProps) {
  return (
    <div className="border-border bg-surface mt-5 flex flex-col items-center rounded-xl border border-dashed px-5 py-12 text-center">
      <span className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-lg">
        <FileText
          aria-hidden="true"
          className="h-4 w-4"
        />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
        {help}
      </p>
      {actionHref && actionLabel ? (
        <Button
          asChild
          variant="secondary"
          className="mt-4 min-h-[44px] sm:min-h-0"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function submissionStatusVariant(
  status: AssignmentStatusRow,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "published") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  if (status === "pending_review" || status === "pending") {
    return "warning";
  }

  return "neutral";
}
