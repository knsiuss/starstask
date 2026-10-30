import "server-only";

import { LEAVE_REASON_LABELS, LEAVE_STATUS_LABELS } from "@starstask/contracts";
import { leaveDayCount, toCsv, withBom } from "@starstask/shared";

import type { LeaveReportRow } from "@/lib/db/leave";
import type { ReportClassInfo } from "@/features/leave/reports/pdf";

/**
 * CSV export.
 *
 * Dates are written as ISO `YYYY-MM-DD` rather than localised text: a spreadsheet
 * sorts them correctly and no viewer's time zone can shift a calendar day. The
 * serialiser neutralises formula-injection prefixes, so a nickname beginning
 * with `=` cannot execute on the reviewer's machine.
 *
 * No storage path, signed URL, or credential is ever written into the file.
 */

export const CSV_HEADERS = [
  "Request reference",
  "Student",
  "Class",
  "Class code",
  "Absence start",
  "Absence end",
  "Days",
  "Document issue date",
  "Reason",
  "Submitted",
  "Status",
  "Cancellation note",
] as const;

export function buildLeaveCsv(
  rows: LeaveReportRow[],
  classInfo: ReportClassInfo,
): string {
  const body = rows.map((row) => [
    row.reference,
    row.studentName,
    classInfo.name,
    classInfo.slug,
    row.leaveStartDate,
    row.leaveEndDate,
    leaveDayCount(row.leaveStartDate, row.leaveEndDate),
    row.documentIssueDate ?? "",
    LEAVE_REASON_LABELS[row.reasonCategory],
    row.submittedAt ? row.submittedAt.slice(0, 10) : "",
    LEAVE_STATUS_LABELS[row.status],
    row.cancellationNote ?? "",
  ]);

  return withBom(toCsv(CSV_HEADERS, body));
}

export function leaveCsvFilename(
  classSlug: string,
  from: string | null,
  to: string | null,
): string {
  const segment = classSlug.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

  return `starstask-absence-${segment}-${from ?? "start"}-${to ?? "today"}.csv`;
}
