import "server-only";

import { notFound } from "next/navigation";

import type { ClassSubjectView } from "@starstask/contracts";

import { getClassSubject } from "@/lib/db/classes";
import {
  requireClassMember,
  type ClassContext,
} from "@/features/classes/class-access";

export type CourseContext = ClassContext & { course: ClassSubjectView };

/**
 * Resolves a course inside a class the caller belongs to.
 *
 * The course is read with both ids together, so a course id from another class
 * group resolves to 404. A class member reaches every course of their class
 * without joining each one separately.
 */
export async function requireCourseContext(
  slug: string,
  courseId: string,
): Promise<CourseContext> {
  const context = await requireClassMember(slug);
  const course = await getClassSubject(context.class.id, courseId);

  if (!course) {
    notFound();
  }

  return { ...context, course };
}
