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
import { resolveCourseSelection } from "@/lib/classes/course-selection";
import {
  getClassBySlug,
  getClassRole,
  listClassSubjects,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Add a class assignment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SubmitPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ course?: string; type?: string }>;
};

export default async function SubmitClassAssignmentPage({
  params,
  searchParams,
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
  const { course: requestedCourseId, type: requestedType } = await searchParams;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.isMember) {
    notFound();
  }

  // New content is filed under one of the class's active courses. Content is
  // never left at the class level.
  const subjects = await listClassSubjects(found.id);
  const { options, selectedId } = resolveCourseSelection(
    subjects,
    requestedCourseId,
  );
  const selectedCourse = options.find((option) => option.id === selectedId);
  const initialValues = submissionInitialValues();
  initialValues.subjectId = selectedId;

  if (role.canManage && requestedType === "class_announcement") {
    initialValues.contentType = "class_announcement";
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
        {role.canManage ? "Post course content" : "Submit an assignment"}
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
      ) : options.length === 0 ? (
        <Alert
          variant="warning"
          className="mt-6"
        >
          <p className="font-medium">This class has no active course yet.</p>
          <p className="mt-1">
            Academic content belongs to a course, so a class admin must add one
            before anything can be posted.{" "}
            {role.canManage ? (
              <Link
                href={`/dashboard/classes/${found.slug}/manage?tab=courses`}
                className="font-medium underline"
              >
                Add a course
              </Link>
            ) : null}
          </p>
        </Alert>
      ) : (
        <div className="mt-8">
          <ClassSubmissionForm
            classSlug={found.slug}
            mode="create"
            initialValues={initialValues}
            publishImmediately={role.canManage}
            courses={options}
            courseName={selectedCourse?.name}
          />
        </div>
      )}
    </div>
  );
}
