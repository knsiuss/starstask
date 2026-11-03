import { ArrowLeft, Paperclip, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabStrip } from "@/components/ui/tab-strip";
import { requireCourseContext } from "@/features/classes/course-access";
import {
  COURSE_ASSIGNMENT_FILTERS,
  COURSE_ASSIGNMENT_FILTER_HELP,
  COURSE_ASSIGNMENT_FILTER_LABELS,
  groupCourseAssignments,
  resolveCourseAssignmentFilter,
  type CourseAssignmentFilter,
} from "@/features/classes/course-assignment-filters";
import { loadCompletionIds } from "@/lib/db/assignment-completions";
import {
  listMyClassSubmissions,
  type MyClassSubmission,
} from "@/lib/db/class-submissions";
import {
  listCourseAssignments,
  type CourseAssignmentSummary,
} from "@/lib/db/classes";
import { cn } from "@/lib/utils/cn";
import type { AssignmentStatusRow } from "@/types/database";
import { formatDate, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Course assignments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SUBMISSION_STATUS_LABELS: Record<AssignmentStatusRow, string> = {
  draft: "Draft",
  pending_review: "In review",
  pending: "In review",
  published: "Published",
  rejected: "Needs revision",
  unpublished: "Unpublished",
  archived: "Archived",
};

type CourseAssignmentsPageProps = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{
    posted?: string;
    submitted?: string;
    filter?: string;
  }>;
};

export default async function CourseAssignmentsPage({
  params,
  searchParams,
}: CourseAssignmentsPageProps) {
  const { slug, courseId } = await params;
  const { posted, submitted, filter: rawFilter } = await searchParams;
  const {
    session,
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);

  const filter = resolveCourseAssignmentFilter(rawFilter);
  const now = new Date();
  const [assignments, ownSubmissions] = await Promise.all([
    listCourseAssignments(found.id, course.id, {
      contentType: "lecturer_assignment",
      limit: 50,
    }),
    listMyClassSubmissions(session.user.id, found.id, 50, course.id),
  ]);
  const completedIds = await loadCompletionIds(
    session.user.id,
    assignments.map((assignment) => assignment.id),
  );

  const { upcoming, inProgress, closed } = groupCourseAssignments(
    assignments,
    completedIds,
    now.getTime(),
  );

  const visibleAssignments =
    filter === "upcoming"
      ? upcoming
      : filter === "in-progress"
        ? inProgress
        : filter === "closed"
          ? closed
          : assignments;

  const courseBase = `/dashboard/classes/${found.slug}/courses/${course.id}`;
  const canPost = found.status === "active" && course.status === "active";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        activeTab="assignments"
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      {posted ? (
        <Alert
          variant="success"
          className="mt-6"
        >
          Your post is published in {course.name}.
        </Alert>
      ) : null}

      {submitted ? (
        <Alert
          variant="info"
          className="mt-6"
        >
          Your submission was sent for review. It appears in this course once a
          class admin approves it.
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Assignments</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {assignments.length} {pluralize(assignments.length, "assignment")}{" "}
            published in this course only.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {role.canManage ? (
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link
                href={`/dashboard/classes/${found.slug}/manage?tab=content`}
              >
                Review queue
              </Link>
            </Button>
          ) : null}
          {canPost ? (
            <Button
              asChild
              size="sm"
            >
              <Link
                href={`/dashboard/classes/${found.slug}/submit?course=${course.id}`}
              >
                <PlusCircle
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                {role.canManage ? "Post assignment" : "Submit assignment"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <TabStrip
        label="Assignment filters"
        className="mt-5"
        items={COURSE_ASSIGNMENT_FILTERS.map((entry) => ({
          href:
            entry === "all"
              ? `${courseBase}/assignments`
              : `${courseBase}/assignments?filter=${entry}`,
          label: COURSE_ASSIGNMENT_FILTER_LABELS[entry],
          active: entry === filter,
        }))}
      />
      <p className="text-muted-foreground mt-2 text-xs">
        {COURSE_ASSIGNMENT_FILTER_HELP[filter]}
      </p>

      {filter === "submitted" ? (
        <SubmissionList
          submissions={ownSubmissions}
          courseName={course.name}
        />
      ) : visibleAssignments.length === 0 ? (
        <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-5 py-12 text-center">
          <p className="text-sm font-medium">{emptyTitle(filter)}</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            {emptyHelp(filter, canPost)}
          </p>
        </div>
      ) : (
        <ul className="divide-border border-border mt-4 divide-y border-y">
          {visibleAssignments.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              classSlug={found.slug}
              completed={completedIds.has(assignment.id)}
              now={now.getTime()}
              canManage={role.canManage}
            />
          ))}
        </ul>
      )}

      <Link
        href={courseBase}
        className="text-muted-foreground hover:text-foreground mt-8 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to course overview
      </Link>
    </div>
  );
}

function AssignmentRow({
  assignment,
  classSlug,
  completed,
  now,
  canManage,
}: {
  assignment: CourseAssignmentSummary;
  classSlug: string;
  completed: boolean;
  now: number;
  canManage: boolean;
}) {
  const isClosed =
    assignment.deadline !== null &&
    new Date(assignment.deadline).getTime() < now;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/assignments/${assignment.id}`}
              className="text-accent text-sm font-medium underline-offset-4 hover:underline"
            >
              {assignment.title}
            </Link>
            {isClosed ? (
              <Badge variant="neutral">Closed</Badge>
            ) : completed ? (
              <Badge variant="success">Done</Badge>
            ) : (
              <Badge variant="accent">Open</Badge>
            )}
            {assignment.attachment_count > 0 ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Paperclip
                  aria-hidden="true"
                  className="h-3 w-3"
                />
                {assignment.attachment_count}
              </span>
            ) : null}
          </div>

          <p className="text-muted-foreground mt-1 line-clamp-2 max-w-2xl text-xs">
            {assignment.description}
          </p>

          <p className="text-muted-foreground mt-1 text-xs">
            Published{" "}
            {formatDate(assignment.published_at ?? assignment.created_at)}
            <span
              aria-hidden="true"
              className="mx-1.5"
            >
              ·
            </span>
            {assignment.deadline
              ? `Due ${formatDate(assignment.deadline)}`
              : "No deadline"}
            {assignment.source_label ? (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1.5"
                >
                  ·
                </span>
                {assignment.source_label}
              </>
            ) : null}
          </p>
        </div>

        {canManage ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button
              asChild
              size="sm"
              variant="ghost"
            >
              <Link href={`/assignments/${assignment.id}/edit`}>Edit</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
            >
              <Link
                href={`/dashboard/classes/${classSlug}/review/${assignment.id}`}
              >
                Review
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function SubmissionList({
  submissions,
  courseName,
}: {
  submissions: MyClassSubmission[];
  courseName: string;
}) {
  if (submissions.length === 0) {
    return (
      <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-5 py-12 text-center">
        <p className="text-sm font-medium">Nothing submitted in this course</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
          Your own submissions in {courseName} appear here with their review
          status.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border border-border mt-4 divide-y border-y">
      {submissions.map((submission) => (
        <li
          key={submission.id}
          className="flex flex-wrap items-start justify-between gap-2 py-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/assignments/${submission.id}`}
                className="text-accent text-sm font-medium underline-offset-4 hover:underline"
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
            <p className="text-muted-foreground mt-1 text-xs">
              Submitted {formatDate(submission.created_at)}
              {submission.deadline
                ? ` · Due ${formatDate(submission.deadline)}`
                : ""}
              {submission.revision > 1
                ? ` · Revision ${submission.revision}`
                : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
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

function emptyTitle(filter: CourseAssignmentFilter): string {
  if (filter === "upcoming") {
    return "No upcoming deadlines";
  }

  if (filter === "in-progress") {
    return "No open-ended assignments";
  }

  if (filter === "closed") {
    return "No closed assignments";
  }

  return "No assignments in this course yet";
}

function emptyHelp(filter: CourseAssignmentFilter, canPost: boolean): string {
  if (filter !== "all") {
    return "Switch to All to see everything published in this course.";
  }

  return canPost
    ? "Create the first assignment for this course. It appears in this course only."
    : "A class admin has not published an assignment in this course yet.";
}
