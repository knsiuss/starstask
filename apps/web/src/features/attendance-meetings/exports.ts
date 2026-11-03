import type { AttendanceExportKind } from "@starstask/contracts";

/**
 * Link to a real export file.
 *
 * Both workbooks are produced per course, so the course id is part of the
 * query. The server checks that the course belongs to the class before it
 * writes the file.
 */
export function attendanceExportHref(
  classSlug: string,
  kind: Extract<AttendanceExportKind, "recap" | "template">,
  subjectId: string,
): string {
  const route = kind === "recap" ? "recap" : "checklist";

  return `/api/classes/${classSlug}/attendance/exports/${route}?subjectId=${subjectId}`;
}
