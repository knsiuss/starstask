import "server-only";

import type { CourseComponentGradeInput } from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CourseComponentGrades = Record<string, number>;

function gradeKey(studentId: string, component: string): string {
  return `${studentId}:${component}`;
}

/**
 * Working per-component scores for one course, keyed by
 * `studentId:component`. Read through the SECURITY DEFINER list function,
 * which admits any class member; the sheet itself is manager-only.
 */
export async function listCourseComponentGrades(
  classId: string,
  subjectId: string,
): Promise<CourseComponentGrades> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_course_component_grades", {
    p_class_id: classId,
    p_subject_id: subjectId,
  });

  if (error) {
    throw new DataAccessError("Could not load course grades", error.code);
  }

  if (data === null || typeof data !== "object") {
    return {};
  }

  const grades: CourseComponentGrades = {};

  const rows = data as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(rows)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      grades[key] = value;
    }
  }

  return grades;
}

/**
 * Saves one component score. The database function is the security
 * boundary: it requires a class manager, validates membership and the
 * 0–100 range, and audits the write.
 */
export async function setCourseComponentGrade(
  classId: string,
  subjectId: string,
  input: CourseComponentGradeInput,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_course_component_grade", {
    p_class_id: classId,
    p_subject_id: subjectId,
    p_student_id: input.studentId,
    p_component: input.component,
    p_score: input.score,
  });

  if (error || data === null) {
    throw new DataAccessError(
      "Could not save the grade",
      error?.code ?? "unknown",
    );
  }

  return typeof data === "number" ? data : input.score;
}

export function courseGradeKey(studentId: string, component: string): string {
  return gradeKey(studentId, component);
}
