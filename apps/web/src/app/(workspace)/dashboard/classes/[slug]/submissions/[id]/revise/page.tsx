import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClassSubmissionForm } from "@/components/forms/class-submission-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getSubmissionDetail } from "@/lib/db/class-submissions";
import { getClassBySlug } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import {
  assignmentIdSchema,
  EDITABLE_SUBMISSION_STATUSES,
} from "@starstask/contracts";
import { toJakartaDateTimeInput } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Revise a submission",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type RevisePageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export default async function ReviseSubmissionPage({
  params,
}: RevisePageProps) {
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

  if (
    !found ||
    !submission ||
    submission.class_id !== found.id ||
    submission.submitter.id !== session.user.id
  ) {
    notFound();
  }

  const editable = (EDITABLE_SUBMISSION_STATUSES as readonly string[]).includes(
    submission.status,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${found.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to {found.name}
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Revise your submission
      </h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        {submission.title} · revision {submission.revision}
      </p>

      {submission.rejection_reason ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Reviewer note</p>
          <p className="mt-1">{submission.rejection_reason}</p>
        </Alert>
      ) : null}

      {editable ? (
        <div className="mt-8">
          <ClassSubmissionForm
            classSlug={found.slug}
            mode="revise"
            assignmentId={submission.id}
            initialValues={{
              title: submission.title,
              description: submission.description,
              assignmentType: submission.assignment_type ?? "",
              deadlineLocal: submission.deadline
                ? toJakartaDateTimeInput(submission.deadline)
                : "",
              tagsText: submission.tags.join(", "),
              referenceUrlsText: submission.reference_urls.join("\n"),
            }}
          />
        </div>
      ) : (
        <Alert
          variant="warning"
          className="mt-6"
        >
          Only rejected or draft submissions can be revised. This submission is
          already {submission.status.replace("_", " ")}.
        </Alert>
      )}
    </div>
  );
}
