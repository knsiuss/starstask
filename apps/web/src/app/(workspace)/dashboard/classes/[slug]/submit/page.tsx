import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  ClassSubmissionForm,
  submissionInitialValues,
} from "@/components/forms/class-submission-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Submit a class assignment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SubmitPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SubmitClassAssignmentPage({
  params,
}: SubmitPageProps) {
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

  const { slug } = await params;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.isMember) {
    notFound();
  }

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
        Submit an assignment
      </h1>
      <p className="text-muted-foreground mt-1.5 text-sm">
        {found.name} · {found.course_name} · {found.semester}{" "}
        {found.academic_year}
      </p>

      {found.status !== "active" ? (
        <Alert
          variant="warning"
          className="mt-6"
        >
          This class is archived and no longer accepts new submissions.
        </Alert>
      ) : (
        <div className="mt-8">
          <ClassSubmissionForm
            classSlug={found.slug}
            mode="create"
            initialValues={submissionInitialValues()}
          />
        </div>
      )}
    </div>
  );
}
