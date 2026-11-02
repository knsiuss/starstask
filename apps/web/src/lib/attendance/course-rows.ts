import {
  summarizeAttendance,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

import type {
  AttendanceFilterOptions,
  AttendanceGroupSummary,
} from "@/lib/db/attendance";

export type CourseAttendanceStatus =
  "excellent" | "good" | "fair" | "at_risk" | "no_sessions";

export type CourseAttendanceRow = {
  /** Subject id when the row is a real course, otherwise the class id. */
  key: string;
  subjectId: string | null;
  code: string | null;
  name: string;
  className: string;
  counts: AttendanceSummaryCounts;
  status: CourseAttendanceStatus;
};

const EMPTY_COUNTS: AttendanceSummaryCounts = summarizeAttendance([]);

/**
 * Percentage bands shared by the course table and the course detail page.
 *
 * Only closed sessions reach the counts, so a course with nothing closed yet
 * reports `no_sessions` instead of a misleading 0%.
 */
export function courseAttendanceStatus(
  counts: Pick<AttendanceSummaryCounts, "percentage" | "eligible">,
): CourseAttendanceStatus {
  if (counts.eligible === 0 || counts.percentage === null) {
    return "no_sessions";
  }

  if (counts.percentage >= 90) {
    return "excellent";
  }

  if (counts.percentage >= 75) {
    return "good";
  }

  if (counts.percentage >= 60) {
    return "fair";
  }

  return "at_risk";
}

export const COURSE_ATTENDANCE_STATUS_LABELS: Record<
  CourseAttendanceStatus,
  string
> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  at_risk: "At risk",
  no_sessions: "No sessions",
};

function rowFromCounts(
  base: Omit<CourseAttendanceRow, "counts" | "status">,
  counts: AttendanceSummaryCounts,
): CourseAttendanceRow {
  return {
    ...base,
    counts,
    status: courseAttendanceStatus(counts),
  };
}

/**
 * Course rows for the student overview.
 *
 * A course is a `class_subjects` row, reachable through the parent class
 * membership. When a class has no subjects yet, its class-level summary is used
 * so the page still shows the records the student actually has.
 */
export function buildCourseRows({
  subjects,
  bySubject,
  byClass,
}: {
  subjects: AttendanceFilterOptions["subjects"];
  bySubject: AttendanceGroupSummary[];
  byClass: AttendanceGroupSummary[];
}): CourseAttendanceRow[] {
  if (subjects.length > 0) {
    const countsBySubject = new Map(
      bySubject.map((group) => [group.key, group.counts]),
    );

    return subjects
      .map((subject) =>
        rowFromCounts(
          {
            key: subject.id,
            subjectId: subject.id,
            code: subject.code,
            name: subject.name,
            className: subject.className,
          },
          countsBySubject.get(subject.id) ?? EMPTY_COUNTS,
        ),
      )
      .sort((left, right) => {
        const leftLabel = left.code ?? left.name;
        const rightLabel = right.code ?? right.name;

        return leftLabel.localeCompare(rightLabel);
      });
  }

  return byClass
    .map((group) =>
      rowFromCounts(
        {
          key: group.key,
          subjectId: null,
          code: null,
          name: group.label,
          className: group.secondaryLabel ?? "Class",
        },
        group.counts,
      ),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}
