import type { Metadata } from "next";

import { ClassMembersTab } from "@/components/classes/class-members-tab";
import { CourseInviteCard } from "@/components/classes/course-invite-card";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { requireCourseContext } from "@/features/classes/course-access";
import { listClassMembers } from "@/lib/db/classes";

export const metadata: Metadata = {
  title: "Course members",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseMembersPageProps = {
  params: Promise<{ slug: string; courseId: string }>;
};

/**
 * Members of one course are the members of its class.
 *
 * Courses never keep their own membership list, so this page is deliberately
 * read-only even for admins; the class page owns joining and roles.
 */
export default async function CourseMembersPage({
  params,
}: CourseMembersPageProps) {
  const { slug, courseId } = await params;
  const {
    session,
    class: found,
    course,
    role,
  } = await requireCourseContext(slug, courseId);

  const members = await listClassMembers(found.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        canManage={false}
        classActive={found.status === "active"}
      />

      {role.canManage && found.status === "active" ? (
        <CourseInviteCard
          classSlug={found.slug}
          courseId={course.id}
          courseName={course.name}
        />
      ) : null}

      <ClassMembersTab
        classSlug={found.slug}
        members={members}
        canManage={false}
        currentUserId={session.user.id}
        inheritedFromClassName={found.name}
      />
    </div>
  );
}
