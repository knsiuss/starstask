import type { Metadata } from "next";

import { CourseOverview } from "@/components/classes/course-overview";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
import { requireCourseContext } from "@/features/classes/course-access";
import { groupUpcomingAssignments } from "@/features/classes/course-assignment-filters";
import { loadCompletionIds } from "@/lib/db/assignment-completions";
import { getStudentAttendance } from "@/lib/db/attendance";
import { countCourseContent, listCourseAssignments } from "@/lib/db/classes";
import {
  courseGradeKey,
  listCourseComponentGrades,
  type CourseComponentGrades,
} from "@/lib/db/course-grades";
import { listCourseMaterials } from "@/lib/db/course-materials";

export const metadata: Metadata = {
  title: "Course overview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CoursePageProps = {
  params: Promise<{ slug: string; courseId: string }>;
};

/**
 * Overview of one course inside a class group.
 *
 * Everything below is scoped to this course, so a sibling course's work never
 * appears here even though the student joined the class only once.
 */
export default async function CourseOverviewPage({ params }: CoursePageProps) {
  const { slug, courseId } = await params;
  const {
    session,
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);

  const [
    assignments,
    announcements,
    materials,
    counts,
    attendanceView,
    allGrades,
  ] = await Promise.all([
    listCourseAssignments(found.id, course.id, {
      contentType: "lecturer_assignment",
      limit: 50,
    }),
    listCourseAssignments(found.id, course.id, {
      contentType: "class_announcement",
      limit: 3,
    }),
    listCourseMaterials(found.id, course.id),
    countCourseContent(found.id, course.id),
    getStudentAttendance(session.user.id, {
      status: "all",
      subject: course.id,
    }),
    listCourseComponentGrades(found.id, course.id).catch(
      (): CourseComponentGrades => ({}),
    ),
  ]);

  const now = new Date();
  const completedIds = await loadCompletionIds(
    session.user.id,
    assignments.map((assignment) => assignment.id),
  );
  const upcomingGroups = groupUpcomingAssignments(
    assignments,
    completedIds,
    now,
  );
  const pendingCount =
    upcomingGroups.dueSoon.length + upcomingGroups.later.length;
  const studentGrades = {
    tugas: allGrades[courseGradeKey(session.user.id, "tugas")] ?? null,
    uts: allGrades[courseGradeKey(session.user.id, "uts")] ?? null,
    uas: allGrades[courseGradeKey(session.user.id, "uas")] ?? null,
  };

  const courseBase = `/classes/${found.slug}/courses/${course.id}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        activeTab="overview"
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      {course.status === "archived" ? (
        <Alert
          variant="warning"
          className="mt-6"
        >
          This course is archived. Its history stays available, but no new
          content can be added.
        </Alert>
      ) : null}

      <CourseOverview
        courseBase={courseBase}
        course={course}
        semester={found.semester}
        academicYear={found.academic_year}
        announcements={announcements}
        recentAssignments={assignments.slice(0, 6)}
        upcomingAssignments={upcomingGroups}
        materials={materials}
        counts={counts}
        attendanceSummary={attendanceView.summary}
        studentGrades={studentGrades}
        pendingCount={pendingCount}
        now={now}
      />
    </div>
  );
}
