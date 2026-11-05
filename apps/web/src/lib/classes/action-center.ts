import type { ClassLifecycleStatus } from "@starstask/contracts";

export type ActionCenterClass = {
  id: string;
  slug: string;
  name: string;
  semester: string;
  academic_year: string;
  status: ClassLifecycleStatus;
  is_admin: boolean;
};

export type ActionCounts = {
  pendingSubmissions: number;
  pendingLeave: number;
  todaysSessions: number;
  openReports: number;
};

export type ActionCenterRow = ActionCounts & {
  classId: string;
  classSlug: string;
  className: string;
  semester: string;
  academicYear: string;
  total: number;
};

export type ActionCenterTotals = ActionCounts & {
  classes: number;
  actions: number;
};

export const EMPTY_ACTION_COUNTS: ActionCounts = {
  pendingSubmissions: 0,
  pendingLeave: 0,
  todaysSessions: 0,
  openReports: 0,
};

/**
 * The action center only answers for classes the caller leads right now.
 * Draft and archived classes stay out: nothing there is waiting on members.
 */
export function selectActionCenterClasses<T extends ActionCenterClass>(
  classes: T[],
): T[] {
  return classes.filter(
    (classItem) => classItem.is_admin && classItem.status === "active",
  );
}

export function countActions(counts: ActionCounts): number {
  return (
    counts.pendingSubmissions +
    counts.pendingLeave +
    counts.todaysSessions +
    counts.openReports
  );
}

export function toActionCenterRow(
  classItem: ActionCenterClass,
  counts: ActionCounts,
): ActionCenterRow {
  return {
    classId: classItem.id,
    classSlug: classItem.slug,
    className: classItem.name,
    semester: classItem.semester,
    academicYear: classItem.academic_year,
    ...counts,
    total: countActions(counts),
  };
}

/** Pairs each class with its grouped count row; unknown classes count as zero. */
export function mergeActionCounts<T extends ActionCenterClass>(
  classes: T[],
  countsByClassId: Map<string, ActionCounts>,
): ActionCenterRow[] {
  return classes.map((classItem) =>
    toActionCenterRow(
      classItem,
      countsByClassId.get(classItem.id) ?? EMPTY_ACTION_COUNTS,
    ),
  );
}

/** Classes with more waiting work come first; ties keep a stable name order. */
export function sortActionCenterRows(
  rows: ActionCenterRow[],
): ActionCenterRow[] {
  return [...rows].sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return left.className.localeCompare(right.className);
  });
}

export function summarizeActionCenter(
  rows: ActionCenterRow[],
): ActionCenterTotals {
  const totals = rows.reduce<ActionCounts>(
    (accumulator, row) => ({
      pendingSubmissions:
        accumulator.pendingSubmissions + row.pendingSubmissions,
      pendingLeave: accumulator.pendingLeave + row.pendingLeave,
      todaysSessions: accumulator.todaysSessions + row.todaysSessions,
      openReports: accumulator.openReports + row.openReports,
    }),
    { ...EMPTY_ACTION_COUNTS },
  );

  return {
    ...totals,
    classes: rows.length,
    actions: countActions(totals),
  };
}
