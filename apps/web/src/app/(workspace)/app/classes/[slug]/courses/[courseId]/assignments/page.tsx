import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileText,
  Inbox,
  Paperclip,
  Plus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AssignmentControls } from "@/components/classes/assignment-controls";
import { AssignmentRowMenu } from "@/components/classes/assignment-row-menu";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCourseContext } from "@/features/classes/course-access";
import {
  filterCourseAssignmentsByQuery,
  groupCourseAssignments,
  resolveCourseAssignmentFilter,
  resolveCourseAssignmentSort,
  sortCourseAssignments,
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
import type { AssignmentStatusRow } from "@/types/database";
import { formatDate, formatTimeRemaining, pluralize } from "@starstask/shared";

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
    q?: string;
    sort?: string;
  }>;
};

export default async function CourseAssignmentsPage({
  params,
  searchParams,
}: CourseAssignmentsPageProps) {
  const { slug, courseId } = await params;
  const {
    posted,
    submitted,
    filter: rawFilter,
    q: rawQuery,
    sort: rawSort,
  } = await searchParams;
  const {
    session,
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);

  const filter = resolveCourseAssignmentFilter(rawFilter);
  const sort = resolveCourseAssignmentSort(rawSort);
  const query = (rawQuery ?? "").trim();
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

  // Search narrows the course list first, so the status groups and the
  // visible rows always describe the same set of assignments.
  const searchedAssignments = filterCourseAssignmentsByQuery(
    assignments,
    query,
  );

  const { upcoming, inProgress, closed } = groupCourseAssignments(
    searchedAssignments,
    completedIds,
    now.getTime(),
  );

  const visibleAssignments = sortCourseAssignments(
    filter === "upcoming"
      ? upcoming
      : filter === "in-progress"
        ? inProgress
        : filter === "closed"
          ? closed
          : searchedAssignments,
    sort,
  );

  const courseBase = `/app/classes/${found.slug}/courses/${course.id}`;
  const canPost = found.status === "active" && course.status === "active";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
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
        <div className="flex items-center gap-3">
          <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Inbox
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Assignments
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {assignments.length} {pluralize(assignments.length, "assignment")}{" "}
              in this course
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {role.canManage ? (
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link
                href={`/app/classes/${found.slug}/manage?tab=content`}
              >
                <Inbox
                  aria-hidden="true"
                  className="h-4 w-4"
                />
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
                href={`/app/classes/${found.slug}/submit?course=${course.id}`}
              >
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                {role.canManage ? "Post assignment" : "Submit assignment"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <Suspense fallback={null}>
          <AssignmentControls
            query={query}
            filter={filter}
            sort={sort}
          />
        </Suspense>
      </div>

      {filter === "submitted" ? (
        <SubmissionList
          submissions={ownSubmissions}
          courseName={course.name}
        />
      ) : visibleAssignments.length === 0 ? (
        <EmptyState
          title={query ? `No assignments match "${query}"` : emptyTitle(filter)}
          help={
            query
              ? "Try a different keyword, or clear the search to see every assignment in this course."
              : emptyHelp(filter, canPost)
          }
        />
      ) : (
        <ul className="border-border bg-surface divide-border mt-5 divide-y overflow-hidden rounded-xl border">
          {visibleAssignments.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              classSlug={found.slug}
              completed={completedIds.has(assignment.id)}
              now={now}
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
  now: Date;
  canManage: boolean;
}) {
  const isClosed =
    assignment.deadline !== null &&
    new Date(assignment.deadline).getTime() < now.getTime();
  const timeRemaining = formatTimeRemaining(assignment.deadline, now);

  return (
    <li className="group hover:bg-muted/50 relative transition-colors">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <FileText
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <div className="min-w-0 flex-1 basis-56">
          {/* The title link stretches over the whole row; the "…" menu sits
              above it with a higher stacking order so it stays clickable. */}
          <Link
            href={`/assignments/${assignment.id}`}
            className="focus-visible:outline-accent text-[15px] font-semibold tracking-tight underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
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
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          {isClosed ? (
            <Badge variant="neutral">Closed</Badge>
          ) : completed ? (
            <Badge variant="success">Done</Badge>
          ) : (
            <Badge variant="accent">Open</Badge>
          )}

          <div className="border-border hidden border-l pl-4 sm:block">
            {assignment.deadline ? (
              <>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarDays
                    aria-hidden="true"
                    className="text-muted-foreground h-4 w-4"
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
              className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5"
            />
          )}
        </div>
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
      <EmptyState
        title="Nothing submitted in this course"
        help={`Your own submissions in ${courseName} appear here with their review status.`}
      />
    );
  }

  return (
    <ul className="border-border bg-surface divide-border mt-6 divide-y overflow-hidden rounded-xl border">
      {submissions.map((submission) => (
        <li
          key={submission.id}
          className="hover:bg-muted/50 px-4 py-4 transition-colors sm:px-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/assignments/${submission.id}`}
                  className="focus-visible:outline-accent text-sm font-semibold underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline"
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
              <p className="text-muted-foreground mt-1.5 text-xs">
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
              className="text-muted-foreground mt-1 h-4 w-4 shrink-0"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, help }: { title: string; help: string }) {
  return (
    <div className="border-border bg-surface mt-6 flex flex-col items-center rounded-xl border border-dashed px-5 py-12 text-center">
      <span className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
        <FileText
          aria-hidden="true"
          className="h-4 w-4"
        />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
        {help}
      </p>
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
