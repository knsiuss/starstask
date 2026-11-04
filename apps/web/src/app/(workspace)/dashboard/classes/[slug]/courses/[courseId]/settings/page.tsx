import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseSettingsForm } from "@/components/classes/course-settings-form";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { requireCourseContext } from "@/features/classes/course-access";

export const metadata: Metadata = {
  title: "Course settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseSettingsPageProps = {
  params: Promise<{ slug: string; courseId: string }>;
};

export default async function CourseSettingsPage({
  params,
}: CourseSettingsPageProps) {
  const { slug, courseId } = await params;
  const {
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);

  if (!role.canManage) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      <CourseSettingsForm
        classSlug={found.slug}
        course={course}
      />
    </div>
  );
}
