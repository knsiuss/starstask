import { ArrowLeft, Pencil, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EvidenceManager } from "@/components/leave/evidence-manager";
import { LeaveCancelActions } from "@/components/leave/leave-cancel-actions";
import { LeaveHistory } from "@/components/leave/leave-history";
import { LeaveStatusBadge } from "@/components/leave/leave-status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getClassRole } from "@/lib/db/classes";
import { getLeaveRequestById, listLeaveHistory } from "@/lib/db/leave";
import { getEvidenceViews } from "@/features/leave/evidence-service";
import {
  readFieldSources,
  readOcrSuggestion,
} from "@/features/leave/field-sources";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import {
  isLeaveRequestCancellable,
  isLeaveRequestEditable,
  LEAVE_REASON_LABELS,
  leaveRequestIdSchema,
  type LeaveFieldSource,
} from "@starstask/contracts";
import {
  formatLeaveDate,
  formatLeaveDateRange,
  leaveDayCount,
} from "@starstask/shared";

export const metadata: Metadata = {
  title: "Absence request",
  // A request page carries medical evidence and personal notes, so it is never
  // indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10";

/** How a value reached the record, in the student's own terms. */
const FIELD_SOURCE_LABELS: Record<LeaveFieldSource, string> = {
  manual: "Entered by the student",
  ocr: "Confirmed from the document",
  ocr_corrected: "Corrected by the student",
};

/**
 * A timestamp's calendar date.
 *
 * Timestamps are stored in UTC; taking the date part of the ISO string prints
 * the same day the record was written, wherever the reader is.
 */
function calendarDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

type LeaveRequestPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; saved?: string }>;
};

export default async function LeaveRequestPage({
  params,
  searchParams,
}: LeaveRequestPageProps) {
  const { id } = await params;
  const parsedId = leaveRequestIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/leave-requests/${id}`));
  }

  const request = await getLeaveRequestById(parsedId.data);

  if (!request) {
    notFound();
  }

  const isOwner = request.studentId === session.user.id;
  const role = isOwner ? null : await getClassRole(request.classId);
  const canManage = !isOwner && (role?.canManage ?? false);

  // RLS already hides another student's request, so this is the friendly path
  // rather than the security boundary.
  if (!isOwner && !canManage) {
    notFound();
  }

  const [evidence, history, query] = await Promise.all([
    getEvidenceViews(request.id),
    listLeaveHistory(request.id),
    searchParams,
  ]);

  const editable = isOwner && isLeaveRequestEditable(request.status);
  const cancellable =
    (isOwner && isLeaveRequestCancellable(request.status)) ||
    (canManage && request.status === "submitted");

  const suggestion = readOcrSuggestion(request.ocrResult);
  const sources = readFieldSources(request.fieldSources);

  const leavePeriod =
    request.leaveStartDate && request.leaveEndDate
      ? formatLeaveDateRange(request.leaveStartDate, request.leaveEndDate)
      : null;
  const days =
    request.leaveStartDate && request.leaveEndDate
      ? leaveDayCount(request.leaveStartDate, request.leaveEndDate)
      : 0;

  return (
    <div className={pageContainer}>
      <Link
        href={
          canManage
            ? `/dashboard/classes/${request.classSlug}/leave-requests`
            : "/leave-requests"
        }
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        {canManage ? "Class requests" : "Your absence requests"}
      </Link>

      {query.submitted ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Request submitted. Your class admin will check it and forward it to
          the lecturer.
        </Alert>
      ) : null}
      {query.saved ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Changes saved.
        </Alert>
      ) : null}

      {request.status === "cancelled" ? (
        <Alert
          variant="info"
          className="mt-4"
        >
          <p className="font-medium">
            This request was cancelled
            {request.cancelledAt
              ? ` on ${formatLeaveDate(calendarDate(request.cancelledAt))}`
              : ""}
            {request.cancelledByName ? ` by ${request.cancelledByName}` : ""}.
          </p>
          {request.cancellationNote ? (
            <p className="mt-1 whitespace-pre-line">
              {request.cancellationNote}
            </p>
          ) : null}
        </Alert>
      ) : null}

      {request.status === "forwarded" ? (
        <Alert
          variant="info"
          className="mt-4"
        >
          <p className="font-medium">
            Forwarded to the lecturer
            {request.forwardedAt
              ? ` on ${formatLeaveDate(calendarDate(request.forwardedAt))}`
              : ""}
            .
          </p>
          <p className="mt-1">
            The package was generated and recorded. Whether the absence is
            granted is the lecturer&apos;s decision, made outside StarsTask.
          </p>
        </Alert>
      ) : null}

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <LeaveStatusBadge status={request.status} />
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide">
            {request.reference}
          </span>
          {canManage ? (
            <Link
              href={`/dashboard/classes/${request.classSlug}`}
              className="bg-muted text-muted-foreground hover:text-accent rounded-full px-2.5 py-0.5 text-xs font-medium"
            >
              {request.className}
            </Link>
          ) : null}
        </div>

        <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
          {canManage
            ? `${request.studentName}'s absence request`
            : "Absence request"}
        </h1>

        {leavePeriod ? (
          <p className="text-muted-foreground mt-1.5 text-sm">
            {leavePeriod} · {days} {days === 1 ? "day" : "days"}
          </p>
        ) : (
          <p className="text-muted-foreground mt-1.5 text-sm">
            Dates not filled in yet.
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="grid gap-8">
          <section aria-labelledby="details-heading">
            <h2
              id="details-heading"
              className="text-lg font-semibold tracking-tight"
            >
              What was requested
            </h2>

            <Card className="mt-3">
              <dl className="grid gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Reason
                  </dt>
                  <dd className="mt-0.5">
                    {request.reasonCategory
                      ? LEAVE_REASON_LABELS[request.reasonCategory]
                      : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Explanation
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line">
                    {request.explanation ?? (
                      <span className="text-muted-foreground">
                        Nothing written yet.
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
          </section>

          <section aria-labelledby="evidence-heading">
            <h2
              id="evidence-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Supporting documents
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Stored privately. Links below expire a few minutes after this page
              loads, and only you {canManage ? "" : "and your class admin "}
              can open them.
            </p>
            <div className="mt-3">
              <EvidenceManager
                requestId={request.id}
                views={evidence}
                editable={editable}
              />
            </div>
          </section>

          <section aria-labelledby="history-heading">
            <h2
              id="history-heading"
              className="text-lg font-semibold tracking-tight"
            >
              History
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Every submission and correction is kept, so the record cannot be
              rewritten.
            </p>
            <div className="mt-3">
              <LeaveHistory entries={history} />
            </div>
          </section>
        </article>

        <aside className="grid content-start gap-4">
          <Card>
            <h2 className="text-sm font-semibold">The dates</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Absence period
                </dt>
                <dd className="mt-0.5">
                  {leavePeriod ?? (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Document issued
                </dt>
                <dd className="mt-0.5">
                  {request.documentIssueDate ? (
                    formatLeaveDate(request.documentIssueDate)
                  ) : (
                    <span className="text-muted-foreground">Not recorded</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Submitted
                </dt>
                <dd className="mt-0.5">
                  {request.submittedAt ? (
                    formatLeaveDate(calendarDate(request.submittedAt))
                  ) : (
                    <span className="text-muted-foreground">
                      Not submitted yet
                    </span>
                  )}
                </dd>
              </div>
              {request.forwardedAt ? (
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Forwarded
                  </dt>
                  <dd className="mt-0.5">
                    {formatLeaveDate(calendarDate(request.forwardedAt))}
                  </dd>
                </div>
              ) : null}
              {request.cancelledAt ? (
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Cancelled
                  </dt>
                  <dd className="mt-0.5">
                    {formatLeaveDate(calendarDate(request.cancelledAt))}
                    {request.cancelledByName
                      ? ` by ${request.cancelledByName}`
                      : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="text-muted-foreground mt-3 text-[11px]">
              These are three different dates. StarsTask never copies one into
              another.
            </p>
          </Card>

          <Card>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4"
              />
              Document reader
            </h2>

            {request.ocrStatus === "not_run" ? (
              <p className="text-muted-foreground mt-2 text-xs">
                No document has been read yet. Upload a PDF and StarsTask will
                offer the dates it finds for you to confirm.
              </p>
            ) : null}

            {request.ocrStatus === "pending" ? (
              <p className="text-muted-foreground mt-2 text-xs">
                The document is being read. You can keep working.
              </p>
            ) : null}

            {request.ocrStatus === "unsupported" ? (
              <p className="text-muted-foreground mt-2 text-xs">
                This file could not be read automatically — it is probably a
                scan or an image. Nothing is blocked; the values on this page
                are the ones you entered.
              </p>
            ) : null}

            {request.ocrStatus === "failed" ? (
              <p className="text-muted-foreground mt-2 text-xs">
                The reader failed on this document. Enter the details by hand.
              </p>
            ) : null}

            {request.ocrStatus === "succeeded" && suggestion ? (
              <div className="mt-3 grid gap-2">
                <ExtractedRow
                  label="Absence start"
                  value={
                    suggestion.leaveStartDate
                      ? formatLeaveDate(suggestion.leaveStartDate)
                      : null
                  }
                  source={sources.leaveStartDate}
                />
                <ExtractedRow
                  label="Absence end"
                  value={
                    suggestion.leaveEndDate
                      ? formatLeaveDate(suggestion.leaveEndDate)
                      : null
                  }
                  source={sources.leaveEndDate}
                />
                <ExtractedRow
                  label="Document issue date"
                  value={
                    suggestion.documentIssueDate
                      ? formatLeaveDate(suggestion.documentIssueDate)
                      : null
                  }
                  source={sources.documentIssueDate}
                />
                <ExtractedRow
                  label="Student name"
                  value={suggestion.studentName ?? null}
                  source={sources.studentName}
                />
                <ExtractedRow
                  label="Document type"
                  value={suggestion.documentType ?? null}
                  source={sources.documentType}
                />

                <p className="text-muted-foreground text-[11px]">
                  {request.ocrConfirmedAt
                    ? `Confirmed by the student on ${formatLeaveDate(calendarDate(request.ocrConfirmedAt))}.`
                    : "Not confirmed yet — these are suggestions, not saved values."}{" "}
                  Reading a document is not a check that it is genuine.
                </p>
              </div>
            ) : null}
          </Card>

          {cancellable ? (
            <Card>
              <h2 className="text-sm font-semibold">Cancel this request</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {canManage
                  ? "Use this when the student no longer needs the absence, or the request cannot be forwarded. The student is told."
                  : "Use this if you no longer need the absence. A forwarded request can no longer be cancelled here."}
              </p>
              <div className="mt-3">
                <LeaveCancelActions
                  requestId={request.id}
                  isClassAdmin={canManage}
                />
              </div>
            </Card>
          ) : null}

          {editable ? (
            <Button
              asChild
              variant="secondary"
            >
              <Link href={`/leave-requests/${request.id}/edit`}>
                <Pencil
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Edit this request
              </Link>
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/**
 * One value the reader offered, with where it came from.
 *
 * A suggestion and a confirmed value look different on purpose: a reviewer must
 * be able to tell a guess from something the student checked.
 */
function ExtractedRow({
  label,
  value,
  source,
}: {
  label: string;
  value: string | null;
  source: LeaveFieldSource | undefined;
}) {
  return (
    <div className="border-border bg-background rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">Not found</span>}
      </p>
      {source ? (
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {FIELD_SOURCE_LABELS[source]}
        </p>
      ) : null}
    </div>
  );
}
