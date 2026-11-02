import type { Metadata } from "next";

import { CourseMaterials } from "@/components/classes/course-materials";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
import { requireCourseContext } from "@/features/classes/course-access";
import { listCourseMaterials } from "@/lib/db/course-materials";

export const metadata: Metadata = {
  title: "Course materials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseMaterialsPageProps = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ compose?: string }>;
};

export default async function CourseMaterialsPage({
  params,
  searchParams,
}: CourseMaterialsPageProps) {
  const { slug, courseId } = await params;
  const { compose } = await searchParams;
  const {
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);
  const materials = await listCourseMaterials(found.id, course.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        activeTab="materials"
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      <div className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Learning materials
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          References, links, and notes for {course.name}. Materials belong to
          this course and are visible to every member of {found.name}.
        </p>
      </div>

      {course.status === "archived" ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          This course is archived. Its materials stay readable but cannot be
          changed.
        </Alert>
      ) : null}

      <CourseMaterials
        classSlug={found.slug}
        courseId={course.id}
        materials={materials}
        canManage={role.canManage}
        courseActive={course.status === "active"}
        initialCompose={compose === "material"}
      />
    </div>
  );
}
