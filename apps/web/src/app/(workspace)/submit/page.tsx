import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssignmentForm } from "@/components/forms/assignment-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { getCourseOptions } from "@/lib/db/assignments";
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
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Submit an assignment
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/submit"));
  }

  const courses = await getCourseOptions();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Submit an assignment
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        Share the brief exactly as you received it. Remove personal data such as
        student names, grades, or private contact details before publishing.
      </p>

      <div className="mt-8">
        <AssignmentForm
          mode="create"
          courseOptions={courses.map((course) => ({
            name: course.name,
            code: course.code,
          }))}
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
    </div>
  );
}
