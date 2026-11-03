import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import type { AttendanceMeetingPhase } from "@starstask/contracts";

export const ATTENDANCE_HISTORY_PAGE_SIZE = 8;

/** Which meetings the history table shows. */
export type AttendanceHistoryFilter = {
  /** Course id, or `null` for every course of the class. */
  subjectId: string | null;
  /** Meeting phase, or `null` for every phase. */
  phase: AttendanceMeetingPhase | null;
};

export type AttendanceHistoryPage<T> = {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * Filters the class meetings for the history table.
 *
 * The list is already scoped to one class by the database, so this only
 * narrows by course and phase. A missing value means "no filter".
 */
export function filterAttendanceMeetings(
  meetings: AttendanceMeetingListItem[],
  filter: AttendanceHistoryFilter,
): AttendanceMeetingListItem[] {
  return meetings.filter((meeting) => {
    if (filter.subjectId && meeting.subjectId !== filter.subjectId) {
      return false;
    }

    if (filter.phase && meeting.phase !== filter.phase) {
      return false;
    }

    return true;
  });
}

/**
 * Slices one page out of a list.
 *
 * The page is clamped into range so a stale page number in the URL still shows
 * content instead of an empty table.
 */
export function paginateAttendanceHistory<T>(
  items: T[],
  page: number,
  pageSize: number = ATTENDANCE_HISTORY_PAGE_SIZE,
): AttendanceHistoryPage<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: currentPage,
    totalPages,
    total,
  };
}
