export type AtRiskStudent = {
  percentage: number | null;
  eligible: number;
};

export type AtRiskSubjectInput = {
  classSlug: string;
  className: string;
  subjectName: string | null;
  subjectId?: string | null;
  students: AtRiskStudent[];
};

export type AtRiskSummaryInput = {
  perSubject: AtRiskSubjectInput[];
};

export type AtRiskClassRow = {
  classSlug: string;
  className: string;
  subjectName: string | null;
  atRiskStudentCount: number;
};

export type AtRiskSummary = {
  atRiskCount: number;
  byClass: AtRiskClassRow[];
};

const AT_RISK_THRESHOLD = 75;

function countAtRiskStudents(students: readonly AtRiskStudent[]): number {
  return students.filter(
    (student) =>
      student.eligible > 0 &&
      student.percentage !== null &&
      student.percentage < AT_RISK_THRESHOLD,
  ).length;
}

/**
 * Reduces per-subject recap inputs into an at-risk (<75%) student summary.
 * Subjects where no student has any eligible meeting are ignored entirely.
 */
export function summarizeAtRisk(input: AtRiskSummaryInput): AtRiskSummary {
  const byClass: AtRiskClassRow[] = [];

  for (const subject of input.perSubject) {
    const eligibleStudents = subject.students.filter(
      (student) => student.eligible > 0,
    );

    if (eligibleStudents.length === 0) {
      continue;
    }

    byClass.push({
      classSlug: subject.classSlug,
      className: subject.className,
      subjectName: subject.subjectName,
      atRiskStudentCount: countAtRiskStudents(eligibleStudents),
    });
  }

  byClass.sort((left, right) => {
    if (right.atRiskStudentCount !== left.atRiskStudentCount) {
      return right.atRiskStudentCount - left.atRiskStudentCount;
    }

    const classOrder = left.className.localeCompare(right.className);

    if (classOrder !== 0) {
      return classOrder;
    }

    return (left.subjectName ?? "").localeCompare(right.subjectName ?? "");
  });

  return {
    atRiskCount: byClass.reduce((sum, row) => sum + row.atRiskStudentCount, 0),
    byClass,
  };
}
