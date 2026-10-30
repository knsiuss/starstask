import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LeaveForm } from "@/components/leave/leave-form";
import { LeaveStatusBadge } from "@/components/leave/leave-status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getLeaveRequestById } from "@/lib/db/leave";
import {
  readFieldSources,
  readOcrSuggestion,
} from "@/features/leave/field-sources";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import {
  isLeaveRequestEditable,
  leaveRequestIdSchema,
} from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Edit absence request",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10";

type EditLeaveRequestPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditLeaveRequestPage({
  params,
}: EditLeaveRequestPageProps) {
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
    redirect(buildLoginPath(`/leave-requests/${id}/edit`));
  }

  const request = await getLeaveRequestById(parsedId.data);

  if (!request) {
    notFound();
  }

  // Only the student may edit, and only while the request is still theirs to
  // change. A submitted request is already with the admin.
  if (request.studentId !== session.user.id) {
    notFound();
  }

  if (!isLeaveRequestEditable(request.status)) {
    redirect(`/leave-requests/${request.id}`);
  }

  const suggestion = readOcrSuggestion(request.ocrResult);
  const fieldSources = readFieldSources(request.fieldSources);

  return (
    <div className={pageContainer}>
      <Link
        href={`/leave-requests/${request.id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to the request
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <LeaveStatusBadge status={request.status} />
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide">
            {request.reference}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[2rem]">
          Edit absence request
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Still a draft — nothing has been sent to your class admin yet.
        </p>
      </header>

      <div className="mt-6">
        <LeaveForm
          mode="edit"
          classId={request.classId}
          requestId={request.id}
          status={request.status}
          initial={{
            leaveStartDate: request.leaveStartDate ?? "",
            leaveEndDate: request.leaveEndDate ?? "",
            reasonCategory: request.reasonCategory ?? "",
            explanation: request.explanation ?? "",
            documentIssueDate: request.documentIssueDate ?? "",
          }}
          suggestion={suggestion}
          fieldSources={fieldSources}
          ocrStatus={request.ocrStatus}
        />
      </div>

      <Alert
        variant="info"
        className="mt-8"
      >
        <p className="font-medium">
          Supporting documents are edited separately
        </p>
        <p className="mt-1">
          Upload or remove files on the{" "}
          <Link
            href={`/leave-requests/${request.id}`}
            className="underline"
          >
            request page
          </Link>
          . At least one is required before you can submit.
        </p>
      </Alert>
    </div>
  );
}
