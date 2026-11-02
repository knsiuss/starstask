import type { ClassSubjectWithTaskCount } from "@starstask/contracts";

export type CourseOption = {
  id: string;
  name: string;
  code: string | null;
};

/** Courses that may receive new academic content. */
export function activeCourseOptions(
  courses: ClassSubjectWithTaskCount[],
): CourseOption[] {
  return courses
    .filter((course) => course.status === "active")
    .map((course) => ({
      id: course.id,
      name: course.name,
      code: course.code,
    }));
}

/**
 * Resolves which course a creation form should open with.
 *
 * A requested course wins only when it is an active course of this class. With
 * exactly one course it is preselected without asking, but it is still sent with
 * the request, so content is never created at class level. With several
 * courses and no valid request, the form stays unselected and requires a
 * choice.
 */
export function resolveCourseSelection(
  courses: ClassSubjectWithTaskCount[],
  requestedId?: string,
): { options: CourseOption[]; selectedId: string } {
  const options = activeCourseOptions(courses);

  if (requestedId && options.some((option) => option.id === requestedId)) {
    return { options, selectedId: requestedId };
  }

  return {
    options,
    selectedId: options.length === 1 ? (options[0]?.id ?? "") : "",
  };
}
