import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  History,
  Paperclip,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttachmentList } from "@/components/assignments/attachment-list";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { AttachmentRemovalButton } from "@/components/review/attachment-removal-button";
import { ModerationActions } from "@/components/review/moderation-actions";
import { ReviewDecisionForm } from "@/components/review/review-decision-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getSessionUser } from "@/lib/auth/session";
import {
  getSubmissionDetail,
  listAssignmentReviews,
} from "@/lib/db/class-submissions";
import {
  getClassBySlug,
  getClassRole,
  isPlatformAdmin,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { getAttachmentViews } from "@/lib/storage/signed-urls";
import { assignmentIdSchema, isSafeHttpUrl } from "@starstask/contracts";
import { formatDate, formatDeadline } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Review submission",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export default async function ReviewSubmissionPage({
  params,
}: ReviewPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard"));
  }

  const { slug, id } = await params;
  const parsedId = assignmentIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const [found, submission] = await Promise.all([
    getClassBySlug(slug),
    getSubmissionDetail(parsedId.data),
  ]);

  if (!found || !submission || submission.class_id !== found.id) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.canManage) {
    notFound();
  }

  const [history, attachments, platformAdmin] = await Promise.all([
    listAssignmentReviews(submission.id),
    getAttachmentViews(submission.attachments),
    isPlatformAdmin(),
  ]);

  const isOwnSubmission = submission.submitter.id === session.user.id;
  const isPending = submission.status === "pending_review";
  const isPublic = submission.status === "published";
  const safeReferenceUrls = submission.reference_urls.filter(isSafeHttpUrl);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${found.slug}/manage`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to class management
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={submission.status} />
            <span className="text-muted-foreground text-xs">
              Revision {submission.revision} · submitted{" "}
              {formatDate(submission.created_at)}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {submission.title}
          </h1>
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-sm">
            <UserRound
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {submission.submitter.display_name}
          </p>
        </div>

        {isPublic ? (
          <Link
            href={`/assignments/${submission.id}`}
            className="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            View public page
            <ExternalLink
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        ) : null}
      </header>

      {submission.rejection_reason && submission.status === "rejected" ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Rejected — the submitter was notified</p>
          <p className="mt-1">{submission.rejection_reason}</p>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Submission</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
            {submission.description}
          </p>

          <dl className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {submission.deadline ? (
              <div className="inline-flex items-center gap-1.5">
                <CalendarDays
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                <dt className="sr-only">Deadline</dt>
                <dd>{formatDeadline(submission.deadline)}</dd>
              </div>
            ) : null}
            <div className="inline-flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Last updated</dt>
              <dd>Updated {formatDate(submission.updated_at)}</dd>
            </div>
          </dl>

          {submission.tags.length > 0 ? (
            <ul
              className="mt-3 flex flex-wrap gap-1.5"
              aria-label="Tags"
            >
              {submission.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="neutral">#{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {safeReferenceUrls.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Reference links</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {safeReferenceUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-accent break-all underline-offset-4 hover:underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section
            aria-labelledby="attachments"
            className="mt-6"
          >
            <h3
              id="attachments"
              className="inline-flex items-center gap-2 text-sm font-medium"
            >
              <Paperclip
                aria-hidden="true"
                className="h-4 w-4"
              />
              Attachments ({submission.attachments.length})
            </h3>

            {submission.attachments.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                No attachments.
              </p>
            ) : (
              <>
                <div className="mt-2">
                  <AttachmentList attachments={attachments} />
                </div>
                {isPublic ? (
                  <Alert
                    variant="warning"
                    className="mt-3"
                  >
                    <p className="font-medium">These files are public.</p>
                    <p className="mt-1 text-xs">
                      If a file contains personal data, grades, or a restricted
                      document, remove it now and record the reason.
                    </p>
                  </Alert>
                ) : null}
                <ul className="mt-3 space-y-2">
                  {submission.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 truncate">
                        {attachment.original_filename}
                      </span>
                      <AttachmentRemovalButton
                        assignmentId={submission.id}
                        attachmentId={attachment.id}
                        filename={attachment.original_filename}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <aside
          aria-labelledby="decision"
          className="space-y-6"
        >
          <div>
            <h2
              id="decision"
              className="text-lg font-semibold tracking-tight"
            >
              Decision
            </h2>

            {isOwnSubmission && isPending ? (
              <Alert
                variant="warning"
                className="mt-3"
              >
                <p className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldAlert
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  You submitted this
                </p>
                <p className="mt-1 text-xs">
                  You cannot review your own submission. Another class admin or
                  a platform admin must decide.
                </p>
              </Alert>
            ) : null}

            {isPending && !isOwnSubmission ? (
              <div className="mt-3">
                <ReviewDecisionForm
                  classSlug={found.slug}
                  submissionId={submission.id}
                />
              </div>
            ) : null}

            {!isPending ? (
              <div className="border-border mt-3 rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">
                  {submission.status === "published"
                    ? "This assignment is published. Moderate it if it violates policy or contains sensitive data."
                    : submission.status === "rejected"
                      ? "This submission was rejected. The submitter can revise and resubmit it."
                      : "This assignment is not public. Restoring publishes it again."}
                </p>
                {submission.status === "published" ||
                submission.status === "unpublished" ||
                submission.status === "archived" ? (
                  <div className="mt-4">
                    <ModerationActions
                      assignmentId={submission.id}
                      status={submission.status}
                      redirectTo={`/dashboard/classes/${found.slug}/manage`}
                      canRestore={platformAdmin}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
              <History
                aria-hidden="true"
                className="h-4 w-4"
              />
              Review history
            </h2>
            {history.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                No decisions recorded yet.
              </p>
            ) : (
              <ul className="divide-border border-border mt-3 divide-y rounded-lg border text-sm">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="px-3 py-2.5"
                  >
                    <p className="font-medium capitalize">{entry.decision}</p>
                    {entry.reason ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {entry.reason}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatDate(entry.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
