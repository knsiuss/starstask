import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssignmentForm } from "@/components/forms/assignment-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { getCourseOptions, getOwnedAssignment } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { assignmentIdSchema } from "@starstask/contracts";
import { toJakartaDateTimeInput } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Edit assignment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type EditAssignmentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAssignmentPage({
  params,
}: EditAssignmentPageProps) {
  const { id } = await params;
  const parsedId = assignmentIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/my-assignments/${parsedId.data}/edit`));
  }

  const [assignment, courses] = await Promise.all([
    getOwnedAssignment(parsedId.data, session.user.id),
    getCourseOptions(),
  ]);

  if (!assignment) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={`/assignments/${assignment.id}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        Back to the assignment
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Edit assignment
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Only you can edit this contribution. Ownership cannot be transferred.
      </p>

      <div className="mt-8">
        <AssignmentForm
          mode="edit"
          assignmentId={assignment.id}
          courseOptions={courses.map((course) => ({
            name: course.name,
            code: course.code,
          }))}
          initialValues={{
            title: assignment.title,
            description: assignment.description,
            courseName: assignment.course_name,
            courseCode: assignment.course_code ?? "",
            department: assignment.course_department ?? "",
            lecturerName: assignment.lecturer_name ?? "",
            semester: assignment.semester ?? "",
            academicYear: assignment.academic_year ?? "",
            assignmentType: assignment.assignment_type ?? "",
            deadlineLocal: assignment.deadline
              ? toJakartaDateTimeInput(assignment.deadline)
              : "",
            tagsText: assignment.tags.join(", "),
            referenceUrlsText: assignment.reference_urls.join("\n"),
          }}
        />
      </div>
    </div>
  );
}
