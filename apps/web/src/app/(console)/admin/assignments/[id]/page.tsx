import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  Paperclip,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentList } from "@/components/assignments/attachment-list";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ReviewDecisionForm } from "@/components/review/review-decision-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { getAttachmentViews } from "@/lib/storage/signed-urls";
import { assignmentIdSchema, isSafeHttpUrl } from "@starstask/contracts";
import { formatDate, formatDeadline } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Review assignment request",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminAssignmentReviewPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Review page for a class-less assignment request.
 *
 * Class-scoped submissions keep their class review page; this route only
 * serves rows created by the public "Submit assignment" form.
 */
export default async function AdminAssignmentReviewPage({
  params,
}: AdminAssignmentReviewPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/assignments");

  const { id } = await params;
  const parsedId = assignmentIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const assignment = await getAssignmentDetail(parsedId.data);

  if (!assignment || assignment.class_id !== null) {
    notFound();
  }

  if (assignment.status !== "pending" && assignment.status !== "rejected") {
    notFound();
  }

  const attachments = await getAttachmentViews(assignment.attachments);
  const safeReferenceUrls = assignment.reference_urls.filter(isSafeHttpUrl);
  const isPending = assignment.status === "pending";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/assignments"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to assignments
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={assignment.status} />
          <span className="text-muted-foreground text-xs">
            Submitted {formatDate(assignment.created_at)}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          {assignment.title}
        </h1>
        <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-sm">
          <UserRound
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          {assignment.author_display_name}
        </p>
      </header>

      {assignment.rejection_reason && assignment.status === "rejected" ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Rejected — the submitter was notified</p>
          <p className="mt-1">{assignment.rejection_reason}</p>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Submission</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
            {assignment.description}
          </p>

          <dl className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <div className="inline-flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Course</dt>
              <dd>
                {assignment.course_code
                  ? `${assignment.course_code} · ${assignment.course_name}`
                  : assignment.course_name}
              </dd>
            </div>
            {assignment.deadline ? (
              <div className="inline-flex items-center gap-1.5">
                <CalendarDays
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                <dt className="sr-only">Deadline</dt>
                <dd>{formatDeadline(assignment.deadline)}</dd>
              </div>
            ) : null}
            <div className="inline-flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              <dt className="sr-only">Last updated</dt>
              <dd>Updated {formatDate(assignment.updated_at)}</dd>
            </div>
          </dl>

          {assignment.tags.length > 0 ? (
            <ul
              className="mt-3 flex flex-wrap gap-1.5"
              aria-label="Tags"
            >
              {assignment.tags.map((tag) => (
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
                      className="text-accent inline-flex items-center gap-1.5 break-all underline-offset-4 hover:underline"
                    >
                      <ExternalLink
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section
            aria-labelledby="public-attachments"
            className="mt-6"
          >
            <h3
              id="public-attachments"
              className="inline-flex items-center gap-2 text-sm font-medium"
            >
              <Paperclip
                aria-hidden="true"
                className="h-4 w-4"
              />
              Attachments ({assignment.attachments.length})
            </h3>

            {attachments.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                No attachments.
              </p>
            ) : (
              <div className="mt-2">
                <AttachmentList attachments={attachments} />
              </div>
            )}
          </section>
        </div>

        <aside
          aria-labelledby="decision"
          className="space-y-4"
        >
          <h2
            id="decision"
            className="text-lg font-semibold tracking-tight"
          >
            Decision
          </h2>

          {isPending ? (
            <ReviewDecisionForm
              endpoint={`/api/admin/assignments/${assignment.id}/review`}
              approvedRedirect="/admin/assignments?reviewed=approved"
              rejectedRedirect="/admin/assignments?reviewed=rejected"
            />
          ) : (
            <div className="border-border rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">
                This request was rejected. It returns to the queue when the
                submitter edits and saves it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
