import {
  ASSIGNMENT_REPORT_REASON_LABELS,
  ASSIGNMENT_REPORT_STATUS_LABELS,
  type AssignmentReportStatus,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import type { MyAssignmentReport } from "@/lib/db/assignment-trust";
import { cn } from "@/lib/utils/cn";

const TONES: Record<AssignmentReportStatus, string> = {
  open: "bg-warning-soft text-warning",
  resolved: "bg-success-soft text-success",
  dismissed: "bg-subtle text-muted-foreground",
};

function describeReport(report: MyAssignmentReport): string {
  if (report.status === "open") {
    return `Filed ${formatDate(report.createdAt)}. A reviewer will check it against the original brief.`;
  }

  if (report.resolutionNote) {
    return report.resolutionNote;
  }

  return report.resolvedAt
    ? `Closed ${formatDate(report.resolvedAt)}.`
    : "This report is closed.";
}

/**
 * The reporter's own view of their report.
 *
 * Without this, a student files a report and never learns whether anyone acted
 * on it. Only the reporter sees this row; RLS hides everyone else's.
 */
export function MyReportStatus({ report }: { report: MyAssignmentReport }) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-xs leading-relaxed",
        TONES[report.status],
      )}
    >
      <p className="font-medium">
        You reported this: {ASSIGNMENT_REPORT_REASON_LABELS[report.reason]} ·{" "}
        {ASSIGNMENT_REPORT_STATUS_LABELS[report.status]}
      </p>
      <p className="mt-0.5 opacity-90">{describeReport(report)}</p>
    </div>
  );
}
