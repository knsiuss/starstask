export const COURSE_ASSIGNMENT_FILTERS = [
  "all",
  "upcoming",
  "in-progress",
  "submitted",
  "closed",
] as const;

export type CourseAssignmentFilter = (typeof COURSE_ASSIGNMENT_FILTERS)[number];

export const COURSE_ASSIGNMENT_FILTER_LABELS: Record<
  CourseAssignmentFilter,
  string
> = {
  all: "All",
  upcoming: "Upcoming",
  "in-progress": "In progress",
  submitted: "Submitted",
  closed: "Closed",
};

export const COURSE_ASSIGNMENT_FILTER_HELP: Record<
  CourseAssignmentFilter,
  string
> = {
  all: "Everything published in this course.",
  upcoming: "Open work with a deadline ahead.",
  "in-progress": "Open work without a deadline.",
  submitted: "Your own submissions in this course.",
  closed: "Deadlines that have already passed.",
};

export function resolveCourseAssignmentFilter(
  value: string | undefined,
): CourseAssignmentFilter {
  return COURSE_ASSIGNMENT_FILTERS.find((filter) => filter === value) ?? "all";
}

type DatedAssignment = {
  id: string;
  deadline: string | null;
};

export type GroupedCourseAssignments<Item extends DatedAssignment> = {
  upcoming: Item[];
  inProgress: Item[];
  closed: Item[];
};

/**
 * Splits published course work for the filter tabs.
 *
 * The app has no per-assignment submission link, so "In progress" means
 * open-ended work without a deadline that the caller has not marked done.
 * Personal completion marks never become submissions, and "Submitted" is
 * handled separately from the caller's own assignment rows.
 */
export function groupCourseAssignments<Item extends DatedAssignment>(
  assignments: readonly Item[],
  completedIds: ReadonlySet<string>,
  nowMs: number,
): GroupedCourseAssignments<Item> {
  const upcoming = assignments
    .filter(
      (assignment) =>
        assignment.deadline !== null &&
        new Date(assignment.deadline).getTime() >= nowMs,
    )
    .sort(
      (first, second) =>
        new Date(first.deadline ?? 0).getTime() -
        new Date(second.deadline ?? 0).getTime(),
    );

  const inProgress = assignments.filter(
    (assignment) =>
      assignment.deadline === null && !completedIds.has(assignment.id),
  );

  const closed = assignments
    .filter(
      (assignment) =>
        assignment.deadline !== null &&
        new Date(assignment.deadline).getTime() < nowMs,
    )
    .sort(
      (first, second) =>
        new Date(second.deadline ?? 0).getTime() -
        new Date(first.deadline ?? 0).getTime(),
    );

  return { upcoming, inProgress, closed };
}
