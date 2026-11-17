import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  Pencil,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { AssignmentContentTypeBadge } from "@/components/assignments/assignment-content-type-badge";
import { DeleteAssignmentButton } from "@/components/assignments/delete-assignment-button";
import { MyReportStatus } from "@/components/assignments/my-report-status";
import { ReportAssignmentButton } from "@/components/assignments/report-assignment-button";
import { SaveAssignmentButton } from "@/components/assignments/save-assignment-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MyAssignmentReport } from "@/lib/db/assignment-trust";
import { cn } from "@/lib/utils/cn";
import {
  formatDate,
  formatDeadline,
  getDeadlineState,
} from "@starstask/shared";

type AssignmentHeaderData = {
  id: string;
  title: string;
  course_name: string;
  course_code: string | null;
  content_type: string;
  source_label: string | null;
  assignment_type: string | null;
  status: string;
  rejection_reason: string | null;
  author_display_name: string;
  created_at: string;
  published_at: string | null;
  deadline: string | null;
  tags: string[];
};

type AssignmentDetailHeaderProps = {
  assignment: AssignmentHeaderData;
  isOwner: boolean;
  isSaved: boolean;
  myReport: MyAssignmentReport | null;
  query: { created?: string; updated?: string };
};

export function AssignmentDetailHeader({
  assignment,
  isOwner,
  isSaved,
  myReport,
  query,
}: AssignmentDetailHeaderProps) {
  const deadlineState = getDeadlineState(assignment.deadline);
  const publishedAt = assignment.published_at ?? assignment.created_at;
  const isPublished = assignment.status === "published";
  const isRejected = assignment.status === "rejected";

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm"
      >
        <Link
          href="/assignments"
          className="hover:text-foreground focus-visible:outline-accent inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md px-1 -ml-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0 sm:px-0 sm:ml-0"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
          Assignments
        </Link>
        <ChevronRight
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 opacity-60"
        />
        <span
          aria-current="page"
          className="text-foreground truncate font-medium"
        >
          {assignment.title}
        </span>
      </nav>

      {query.created ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          {isPublished
            ? "Published. The brief is already in the public archive."
            : "Submitted for review. A platform admin checks new requests before they appear in the public archive."}
        </Alert>
      ) : null}

      {query.updated ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Your changes have been saved.
        </Alert>
      ) : null}

      {isOwner && isRejected && assignment.rejection_reason ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="font-medium">Your request needs changes</p>
          <p className="mt-1">{assignment.rejection_reason}</p>
          <p className="mt-2 text-xs">
            Edit the assignment and save it to send it back for review.
          </p>
        </Alert>
      ) : null}

      <header className="mt-4 sm:mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="accent"
            className="gap-1.5"
          >
            <BookOpen
              aria-hidden="true"
              className="h-3 w-3"
            />
            {assignment.course_code
              ? `${assignment.course_code} · ${assignment.course_name}`
              : assignment.course_name}
          </Badge>
          <AssignmentContentTypeBadge
            contentType={assignment.content_type}
            sourceLabel={assignment.source_label}
          />
          {assignment.assignment_type ? (
            <Badge>{assignment.assignment_type}</Badge>
          ) : null}
          {assignment.status === "pending" ? (
            <Badge variant="warning">Pending approval</Badge>
          ) : null}
          {isRejected ? <Badge variant="danger">Rejected</Badge> : null}
        </div>

        <h1 className="text-foreground mt-3 text-2xl leading-tight font-semibold tracking-tight text-balance break-words sm:text-3xl">
          {assignment.title}
        </h1>

        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <UserRound
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <span className="truncate">{assignment.author_display_name}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            {isPublished ? "Published" : "Submitted"}{" "}
            {formatDate(isPublished ? publishedAt : assignment.created_at)}
          </span>
          {assignment.deadline ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                deadlineState === "overdue"
                  ? "text-danger"
                  : deadlineState === "due_today"
                    ? "text-warning"
                    : "text-foreground",
              )}
            >
              <Clock
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              {deadlineState === "overdue" ? "Overdue: " : "Due "}
              {formatDeadline(assignment.deadline)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              No deadline
            </span>
          )}
        </div>

        {isOwner ? (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="min-h-[44px] px-4 sm:min-h-8 sm:px-3"
            >
              <Link href={`/assignments/${assignment.id}/edit`}>
                <Pencil
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Edit assignment
              </Link>
            </Button>
            <DeleteAssignmentButton
              assignmentId={assignment.id}
              title={assignment.title}
              variant="inline"
            />
          </div>
        ) : null}

        {!isOwner && isPublished ? (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <SaveAssignmentButton
              assignmentId={assignment.id}
              initialSaved={isSaved}
            />
            <ReportAssignmentButton assignmentId={assignment.id} />
          </div>
        ) : null}

        {!isOwner && myReport ? (
          <div className="mt-3">
            <MyReportStatus report={myReport} />
          </div>
        ) : null}

        {assignment.tags.length > 0 ? (
          <ul
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Tags"
          >
            {assignment.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/assignments?tag=${encodeURIComponent(tag)}`}
                  className="bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent focus-visible:outline-accent inline-flex min-h-[36px] items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0 sm:px-2.5"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>
    </>
  );
}
