import "server-only";

import { getClassAttendanceRecap } from "@/lib/db/attendance-meetings";
import {
  listActiveCoursesByClass,
  listMyClassDirectory,
} from "@/lib/db/classes";
import {
  summarizeAtRisk,
  type AtRiskSummary,
  type AtRiskSubjectInput,
} from "@/lib/lecturer/at-risk";

/**
 * Loads the at-risk (<75%) summary for classes the caller administers.
 *
 * One recap call per subject; expensive on large inventories but reuses the
 * same server path as the per-course attendance page. TeachingHome catches
 * any failure and renders the console without the metric.
 */
export async function loadLecturerAtRisk(
  userId: string,
): Promise<AtRiskSummary> {
  const directory = await listMyClassDirectory(userId);
  const administered = directory.filter(
    (row) => row.status === "active" && row.is_admin,
  );

  if (administered.length === 0) {
    return summarizeAtRisk({ perSubject: [] });
  }

  const classIds = administered.map((row) => row.id);
  const coursesByClass = await listActiveCoursesByClass(classIds);

  const perSubject: AtRiskSubjectInput[] = [];

  for (const klass of administered) {
    const subjects = coursesByClass.get(klass.id) ?? [];

    for (const subject of subjects) {
      const recap = await getClassAttendanceRecap(klass.id, subject.id);

      perSubject.push({
        classSlug: klass.slug,
        className: klass.name,
        subjectName: subject.name,
        subjectId: subject.id,
        students: recap.students.map((student) => ({
          percentage: student.totals.percentage,
          eligible: student.totals.eligible,
        })),
      });
    }
  }

  return summarizeAtRisk({ perSubject });
}
