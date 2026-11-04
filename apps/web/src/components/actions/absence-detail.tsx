import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Download } from "lucide-react";

import { LeaveHistory } from "@/components/leave/leave-history";
import { LeaveReviewActions } from "@/components/leave/leave-review-actions";
import { LeaveStatusBadge } from "@/components/leave/leave-status-badge";
import { Card } from "@/components/ui/card";
import type { EvidenceView } from "@/features/leave/evidence-service";
import type {
  AffectedSession,
  LeaveHistoryEntry,
  LeaveRequestSummary,
} from "@/lib/db/leave";
import { LEAVE_REASON_LABELS } from "@starstask/contracts";
import { formatLeaveDate, formatLeaveDateRange } from "@starstask/shared";

function formatSessionTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupSessionsByCourse(sessions: AffectedSession[]) {
  const grouped = new Map<string, AffectedSession[]>();

  for (const session of sessions) {
    const key = session.courseName;
    const list = grouped.get(key) ?? [];
    list.push(session);
    grouped.set(key, list);
  }

  return [...grouped.entries()];
}

/**
 * The full review interface for one absence request (sections A–E).
 *
 * Affected sessions are derived server-side from the request's class, covered
 * courses, Jakarta date range, and the student's join date — the same rule
 * approval applies to attendance. Meeting numbers are shown per course because
 * one number can mean different dates in different courses.
 */
export function AbsenceDetail({
  request,
  sessions,
  evidence,
  history,
}: {
  request: LeaveRequestSummary;
  sessions: AffectedSession[];
  evidence: EvidenceView[];
  history: LeaveHistoryEntry[];
}) {
  const period =
    request.leaveStartDate && request.leaveEndDate
      ? formatLeaveDateRange(request.leaveStartDate, request.leaveEndDate)
      : "Dates not set yet";

  const grouped = groupSessionsByCourse(sessions);
  const awaitingReview = request.status === "submitted";

  return (
    <div className="mt-4 space-y-4">
      <Link
        href="/dashboard/actions?tab=absences"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to absence requests
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <LeaveStatusBadge status={request.status} />
            <span className="text-muted-foreground font-mono text-[11px] tracking-wide">
              {request.reference}
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
            {request.studentName}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {request.className} · Submitted{" "}
            {request.submittedAt
              ? formatLeaveDate(request.submittedAt.slice(0, 10))
              : "—"}
          </p>
        </div>
      </div>

      {/* A + B: student and affected courses/sessions */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Affected courses and sessions</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Derived from the absence period and the covered courses. Approving
          marks these sessions as excused — never as present — and never touches
          a session the student actually attended.
        </p>
        {grouped.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No scheduled sessions fall in this absence period.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {grouped.map(([courseName, courseSessions]) => (
              <div key={courseName}>
                <h4 className="text-sm font-medium">
                  {courseName}
                  {courseSessions[0]?.courseCode
                    ? ` (${courseSessions[0].courseCode})`
                    : ""}
                </h4>
                <ul className="mt-1.5 grid gap-1.5">
                  {courseSessions.map((session) => (
                    <li
                      key={session.id}
                      className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
                    >
                      <span className="text-foreground font-medium">
                        {session.meetingNumber
                          ? `Meeting ${session.meetingNumber}`
                          : "Meeting"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                        {formatLeaveDate(session.startsAt.slice(0, 10))} ·{" "}
                        {formatSessionTime(session.startsAt)}–
                        {formatSessionTime(session.endsAt)} (Asia/Jakarta)
                      </span>
                      <span className="capitalize">{session.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
          <span className="font-mono">{request.studentId.slice(0, 8)}</span> ·
          Student {request.studentId.slice(0, 8)}
        </p>
      </Card>

      {/* C: absence information */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Absence information</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Absence period</dt>
            <dd className="mt-0.5 font-medium">{period}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Reason</dt>
            <dd className="mt-0.5 font-medium">
              {request.reasonCategory
                ? LEAVE_REASON_LABELS[request.reasonCategory]
                : "Not set"}
            </dd>
          </div>
        </dl>
        {request.explanation ? (
          <div className="mt-3">
            <dt className="text-muted-foreground text-xs">Explanation</dt>
            <dd className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-line">
              {request.explanation}
            </dd>
          </div>
        ) : null}
      </Card>

      {/* D: supporting documents */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Supporting documents</h3>
        {evidence.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">
            No supporting documents provided.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="border-border rounded-xl border p-3"
              >
                {item.mimeType.startsWith("image/") && item.signedUrl ? (
                  <Image
                    src={item.signedUrl}
                    alt={item.originalFilename}
                    width={800}
                    height={600}
                    unoptimized
                    className="border-border max-h-72 w-full rounded-lg border object-contain"
                  />
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.originalFilename}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.mimeType} · {formatFileSize(item.fileSize)}
                    </p>
                  </div>
                  {item.signedUrl ? (
                    <a
                      href={item.signedUrl}
                      download={item.originalFilename}
                      className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <Download
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Download
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Preview unavailable
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* E: review history */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Review history</h3>
        <div className="mt-3">
          <LeaveHistory entries={history} />
        </div>
      </Card>

      {/* Actions */}
      {awaitingReview ? (
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold">Review</h3>
          <div className="mt-3">
            <LeaveReviewActions
              requestId={request.id}
              classSlug={request.classSlug}
            />
          </div>
        </Card>
      ) : request.status === "revision_requested" ? (
        <p className="text-muted-foreground text-sm">
          Revision requested. The student can edit and resubmit this request;
          the history above is preserved.
        </p>
      ) : null}
    </div>
  );
}
