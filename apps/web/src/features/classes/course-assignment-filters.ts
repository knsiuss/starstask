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

import { getJakartaDayDifference } from "@starstask/shared";

/** Calendar days (Asia/Jakarta) that count as "due soon" on the course overview. */
export const UPCOMING_DUE_SOON_DAYS = 3;

export type GroupedUpcomingAssignments<Item extends DatedAssignment> = {
  dueSoon: Item[];
  later: Item[];
};

/**
 * Splits unfinished, future-dated work for the overview's Upcoming section.
 *
 * Only this section's window is three days; the dashboard's "due soon"
 * statistic intentionally uses its own seven-day window. Overdue and
 * completed work belong on the Assignments page, never here, and undated
 * work has no position in a deadline-ordered list.
 */
export function groupUpcomingAssignments<Item extends DatedAssignment>(
  assignments: readonly Item[],
  completedIds: ReadonlySet<string>,
  now: Date,
): GroupedUpcomingAssignments<Item> {
  const upcoming = assignments
    .filter(
      (assignment) =>
        assignment.deadline !== null &&
        new Date(assignment.deadline).getTime() > now.getTime() &&
        !completedIds.has(assignment.id),
    )
    .sort(
      (first, second) =>
        new Date(first.deadline ?? 0).getTime() -
        new Date(second.deadline ?? 0).getTime(),
    );

  const dueSoon: Item[] = [];
  const later: Item[] = [];

  for (const assignment of upcoming) {
    const dayDifference = getJakartaDayDifference(
      assignment.deadline ?? now,
      now,
    );

    if (dayDifference <= UPCOMING_DUE_SOON_DAYS) {
      dueSoon.push(assignment);
    } else {
      later.push(assignment);
    }
  }

  return { dueSoon, later };
}

export function resolveCourseAssignmentFilter(
  value: string | undefined,
): CourseAssignmentFilter {
  return COURSE_ASSIGNMENT_FILTERS.find((filter) => filter === value) ?? "all";
}

export const COURSE_ASSIGNMENT_SORTS = [
  "due-soonest",
  "due-latest",
  "recent",
  "title",
] as const;

export type CourseAssignmentSort = (typeof COURSE_ASSIGNMENT_SORTS)[number];

export const COURSE_ASSIGNMENT_SORT_LABELS: Record<
  CourseAssignmentSort,
  string
> = {
  "due-soonest": "Due date (soonest)",
  "due-latest": "Due date (latest)",
  recent: "Recently published",
  title: "Title (A–Z)",
};

export function resolveCourseAssignmentSort(
  value: string | undefined,
): CourseAssignmentSort {
  return (
    COURSE_ASSIGNMENT_SORTS.find((sort) => sort === value) ?? "due-soonest"
  );
}

type SearchableAssignment = {
  title: string;
  description?: string;
  source_label?: string | null;
};

/** Case-insensitive substring match over title, description, and source. */
export function filterCourseAssignmentsByQuery<
  Item extends SearchableAssignment,
>(assignments: readonly Item[], query: string): Item[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [...assignments];
  }

  return assignments.filter((assignment) =>
    [
      assignment.title,
      assignment.description ?? "",
      assignment.source_label ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

type SortableAssignment = {
  title: string;
  deadline: string | null;
  published_at: string | null;
  created_at: string;
};

/** Orders a copy of the list; undated work always sorts last by deadline. */
export function sortCourseAssignments<Item extends SortableAssignment>(
  assignments: readonly Item[],
  sort: CourseAssignmentSort,
): Item[] {
  const sorted = [...assignments];

  switch (sort) {
    case "due-latest":
      return sorted.sort(
        (first, second) =>
          deadlineTimeLatest(second) - deadlineTimeLatest(first) ||
          first.title.localeCompare(second.title),
      );
    case "recent":
      return sorted.sort(
        (first, second) =>
          publishedTime(second) - publishedTime(first) ||
          first.title.localeCompare(second.title),
      );
    case "title":
      return sorted.sort((first, second) =>
        first.title.localeCompare(second.title),
      );
    case "due-soonest":
    default:
      return sorted.sort(
        (first, second) =>
          deadlineTime(first) - deadlineTime(second) ||
          first.title.localeCompare(second.title),
      );
  }
}

function deadlineTime(assignment: SortableAssignment): number {
  return assignment.deadline
    ? new Date(assignment.deadline).getTime()
    : Number.POSITIVE_INFINITY;
}

function deadlineTimeLatest(assignment: SortableAssignment): number {
  return assignment.deadline
    ? new Date(assignment.deadline).getTime()
    : Number.NEGATIVE_INFINITY;
}

function publishedTime(assignment: SortableAssignment): number {
  return new Date(assignment.published_at ?? assignment.created_at).getTime();
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
