import { ArrowLeft, Inbox, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AssignmentControls } from "@/components/classes/assignment-controls";
import {
  CourseAssignmentEmptyState,
  CourseAssignmentRow,
  CourseSubmissionList,
} from "@/components/classes/course-assignment-list";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
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
import { listMyClassSubmissions } from "@/lib/db/class-submissions";
import { listCourseAssignments } from "@/lib/db/classes";
import { pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Course assignments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

  const courseBase = `/classes/${found.slug}/courses/${course.id}`;
  const assignmentsBase = `${courseBase}/assignments`;
  const canPost = found.status === "active" && course.status === "active";
  const isFiltered = query.length > 0 || filter !== "all";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6 sm:pt-8 sm:pb-10 lg:px-8">
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Assignments
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {assignments.length} {pluralize(assignments.length, "assignment")}{" "}
            in this course
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {role.canManage ? (
            <Button
              asChild
              variant="secondary"
              className="min-h-[44px] sm:h-9 sm:min-h-0 sm:px-3.5"
            >
              <Link href={`/classes/${found.slug}/manage?tab=content`}>
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
              className="min-h-[44px] sm:h-9 sm:min-h-0 sm:px-3.5"
            >
              <Link href={`/classes/${found.slug}/submit?course=${course.id}`}>
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

      <div className="mt-4 sm:mt-5">
        <Suspense fallback={null}>
          <AssignmentControls
            query={query}
            filter={filter}
            sort={sort}
          />
        </Suspense>
      </div>

      {filter === "submitted" ? (
        <CourseSubmissionList
          submissions={ownSubmissions}
          courseName={course.name}
        />
      ) : visibleAssignments.length === 0 ? (
        <CourseAssignmentEmptyState
          title={query ? `No assignments match "${query}"` : emptyTitle(filter)}
          help={
            query
              ? "Try a different keyword, or clear the search to see every assignment in this course."
              : emptyHelp(filter, canPost)
          }
          actionHref={isFiltered ? assignmentsBase : undefined}
          actionLabel={isFiltered ? "Reset filters" : undefined}
        />
      ) : (
        <ul className="border-border bg-surface divide-border mt-5 divide-y overflow-hidden rounded-xl border">
          {visibleAssignments.map((assignment) => (
            <CourseAssignmentRow
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
        className="text-muted-foreground hover:text-foreground focus-visible:outline-accent mt-6 inline-flex min-h-[44px] items-center gap-1.5 rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:mt-8 sm:min-h-0"
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
