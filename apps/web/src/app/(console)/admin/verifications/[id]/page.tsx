import { ArrowLeft, FileText, History, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VerificationDecisionForm } from "@/components/admin/verification-decision-form";
import { VerificationRevokeForm } from "@/components/admin/verification-revoke-form";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  getVerificationRequestById,
  listVerificationHistory,
} from "@/lib/db/verification";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  VERIFICATION_STATUS_LABELS,
  verificationRequestIdSchema,
} from "@starstask/contracts";
import { formatDate, formatFileSize } from "@starstask/shared";
import { getVerificationEvidenceViews } from "@/features/verification/evidence-service";

export const metadata: Metadata = {
  title: "Review verification request",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  created: "Draft created",
  updated: "Explanation updated",
  submitted: "Submitted for review",
  resubmitted: "Resubmitted for review",
  evidence_added: "Evidence attached",
  evidence_removed: "Evidence removed",
  revision_requested: "Revision requested",
  approved: "Approved",
  rejected: "Rejected",
  access_revoked: "Class admin access revoked",
};

type AdminVerificationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminVerificationPage({
  params,
}: AdminVerificationPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/verifications");

  const { id } = await params;
  const parsed = verificationRequestIdSchema.safeParse(id);

  if (!parsed.success) {
    notFound();
  }

  const request = await getVerificationRequestById(parsed.data);

  // RLS hides another student's draft, so a direct link to one is a 404 here.
  if (!request) {
    notFound();
  }

  const [evidence, history] = await Promise.all([
    getVerificationEvidenceViews(request.id),
    listVerificationHistory(request.id),
  ]);

  const canDecide =
    request.status === "pending" || request.status === "needs_revision";
  const canRevoke =
    request.status === "verified" && request.hasClassAdminAccess;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/verifications"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Verification queue
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          <span className="text-muted-foreground text-xs">
            {request.submittedAt
              ? `Submitted ${formatDate(request.submittedAt)}`
              : "Not submitted"}
            {request.reviewedAt
              ? ` · Reviewed ${formatDate(request.reviewedAt)}`
              : ""}
            {request.revisionCount > 0
              ? ` · ${request.revisionCount} revision${request.revisionCount === 1 ? "" : "s"}`
              : ""}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {request.studentName}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Class representative claim for {request.className}
          {request.classSemester ? ` · ${request.classSemester}` : ""}
        </p>
      </header>

      {request.status === "verified" && request.hasClassAdminAccess ? (
        <Alert
          variant="success"
          className="mt-5"
        >
          Verified. Class admin access is active for {request.className}.
        </Alert>
      ) : null}

      {request.status === "verified" && !request.hasClassAdminAccess ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          Verified, but no class admin assignment is active for this class. It
          may have been revoked after approval.
        </Alert>
      ) : null}

      {request.status === "rejected" ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Rejected — no access was granted.</p>
          {request.reviewNote ? (
            <p className="mt-1 whitespace-pre-line">{request.reviewNote}</p>
          ) : null}
        </Alert>
      ) : null}

      {request.status === "needs_revision" ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          <p className="font-medium">Waiting for the student to resubmit.</p>
          {request.reviewNote ? (
            <p className="mt-1 whitespace-pre-line">{request.reviewNote}</p>
          ) : null}
        </Alert>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">
          The student&apos;s claim
        </h2>
        <p className="border-border mt-3 rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-line">
          {request.statement ?? (
            <span className="text-muted-foreground">
              No explanation was provided.
            </span>
          )}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <FileText
            aria-hidden="true"
            className="h-4 w-4"
          />
          Supporting evidence
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Human review only. StarsTask validates the file type, not whether the
          document is genuine.
        </p>

        {evidence.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No evidence is attached to this request.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.originalFilename}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFileSize(item.fileSize)} ·{" "}
                    {item.mimeType === "application/pdf"
                      ? "PDF"
                      : item.mimeType === "image/png"
                        ? "PNG"
                        : "JPG"}
                  </p>
                </div>
                {item.signedUrl ? (
                  <a
                    href={item.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent text-sm underline-offset-4 hover:underline"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Unavailable
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          Links expire after five minutes and are issued only to authorized
          reviewers.
        </p>
      </section>

      {canDecide ? (
        <section
          aria-labelledby="verification-decision"
          className="border-border bg-surface mt-8 rounded-xl border p-5 sm:p-6"
        >
          <h2
            id="verification-decision"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <ShieldCheck
              aria-hidden="true"
              className="h-4 w-4"
            />
            Platform decision
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Only approval creates a class admin assignment, and only for{" "}
            {request.className}.
          </p>
          <div className="mt-5">
            <VerificationDecisionForm
              requestId={request.id}
              className={request.className}
              studentName={request.studentName}
            />
          </div>
        </section>
      ) : null}

      {canRevoke ? (
        <section
          aria-labelledby="verification-revoke"
          className="border-border bg-surface mt-8 rounded-xl border p-5 sm:p-6"
        >
          <h2
            id="verification-revoke"
            className="text-lg font-semibold tracking-tight"
          >
            Revoke class admin access
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Removes the assignment for this class only. The verification record
            and history remain.
          </p>
          <div className="mt-5">
            <VerificationRevokeForm
              requestId={request.id}
              className={request.className}
              studentName={request.studentName}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <History
            aria-hidden="true"
            className="h-4 w-4"
          />
          Review history
        </h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No history recorded yet.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border text-sm">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {ACTION_LABELS[entry.action] ??
                      entry.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
                {entry.previousStatus && entry.newStatus ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {VERIFICATION_STATUS_LABELS[entry.previousStatus]} →{" "}
                    {VERIFICATION_STATUS_LABELS[entry.newStatus]}
                  </p>
                ) : null}
                {entry.note ? (
                  <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                    {entry.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
