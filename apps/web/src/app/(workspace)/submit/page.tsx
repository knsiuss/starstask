import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssignmentForm } from "@/components/forms/assignment-form";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import {
  canPublishPublicAssignment,
  getMemberCourseOptions,
  listOwnedAssignmentTemplates,
} from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Submit an assignment",
  description: "Contribute an assignment brief to the StarsTask archive.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SubmitAssignmentPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell width="narrow">
        <h1 className="text-3xl font-semibold tracking-tight">
          Submit an assignment
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </PageShell>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/submit"));
  }

  const [courses, previousAssignments, publishesDirectly] = await Promise.all([
    getMemberCourseOptions(session.user.id),
    listOwnedAssignmentTemplates(session.user.id).catch(() => []),
    canPublishPublicAssignment().catch(() => false),
  ]);

  const routingSentence = publishesDirectly
    ? "Your submission appears in the public archive as soon as you save it."
    : "Your submission becomes a request: a platform admin reviews it before it appears in the public archive.";

  return (
    <PageShell width="narrow">
      <h1 className="text-3xl font-semibold tracking-tight">
        Submit an assignment
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        Share the brief exactly as you received it. {routingSentence} Remove
        personal data such as student names, grades, or private contact details
        before submitting.
      </p>

      <div className="mt-8">
        <AssignmentForm
          mode="create"
          courseOptions={courses}
          previousAssignments={previousAssignments}
          publishesDirectly={publishesDirectly}
          initialValues={{
            title: "",
            description: "",
            courseName: "",
            courseCode: "",
            department: "",
            lecturerName: "",
            semester: "",
            academicYear: "",
            assignmentType: "",
            deadlineLocal: "",
            tagsText: "",
            referenceUrlsText: "",
          }}
        />
      </div>
    </PageShell>
  );
}
