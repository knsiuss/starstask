import Link from "next/link";
import { CalendarDays, FileText, Paperclip } from "lucide-react";

import { LeaveStatusBadge } from "@/components/leave/leave-status-badge";
import { LEAVE_REASON_LABELS } from "@starstask/contracts";
import {
  formatLeaveDate,
  formatLeaveDateRange,
  leaveDayCount,
} from "@starstask/shared";

import type { LeaveRequestSummary } from "@/lib/db/leave";

/**
 * One request in a list.
 *
 * Shows the three dates separately and never merges them: the leave dates, the
 * submission date, and the document issue date answer different questions.
 */
export function LeaveRequestCard({
  request,
  href,
  showStudent = false,
}: {
  request: LeaveRequestSummary;
  href: string;
  showStudent?: boolean;
}) {
  const dates =
    request.leaveStartDate && request.leaveEndDate
      ? formatLeaveDateRange(request.leaveStartDate, request.leaveEndDate)
      : "Dates not set yet";

  const days =
    request.leaveStartDate && request.leaveEndDate
      ? leaveDayCount(request.leaveStartDate, request.leaveEndDate)
      : 0;

  return (
    <Link
      href={href}
      className="border-border bg-card hover:border-accent/60 focus-visible:ring-ring block rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-[11px] tracking-wide">
            {request.reference}
          </p>
          <p className="mt-1 truncate text-base font-semibold">
            {showStudent ? request.studentName : request.className}
          </p>
          {showStudent ? (
            <p className="text-muted-foreground text-xs">{request.className}</p>
          ) : null}
        </div>

        <LeaveStatusBadge status={request.status} />
      </div>

      <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <dt className="sr-only">Absence dates</dt>
          <dd>
            {dates}
            {days > 0 ? ` · ${days} ${days === 1 ? "day" : "days"}` : ""}
          </dd>
        </div>

        <div>
          <dt className="sr-only">Reason</dt>
          <dd>
            {request.reasonCategory
              ? LEAVE_REASON_LABELS[request.reasonCategory]
              : "Reason not set"}
          </dd>
        </div>

        <div className="flex items-center gap-1.5">
          <Paperclip
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <dt className="sr-only">Evidence</dt>
          <dd>
            {request.evidenceCount}{" "}
            {request.evidenceCount === 1 ? "file" : "files"}
          </dd>
        </div>
      </dl>

      {request.submittedAt ? (
        <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
          <FileText
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Submitted {formatLeaveDate(request.submittedAt.slice(0, 10))}
        </p>
      ) : null}

      {request.status === "forwarded" ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Forwarded
          {request.forwardedAt
            ? ` on ${formatLeaveDate(request.forwardedAt.slice(0, 10))}`
            : ""}{" "}
          — the lecturer decides outside StarsTask.
        </p>
      ) : null}

      {request.status === "cancelled" ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Cancelled
          {request.cancelledAt
            ? ` on ${formatLeaveDate(request.cancelledAt.slice(0, 10))}`
            : ""}
          {request.cancelledByName ? ` by ${request.cancelledByName}` : ""}.
        </p>
      ) : null}
    </Link>
  );
}
