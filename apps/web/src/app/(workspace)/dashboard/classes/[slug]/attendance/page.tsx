import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AttendanceCourseFilter } from "@/components/attendance/attendance-course-filter";
import { ClassAttendanceWorkspace } from "@/components/attendance/class-attendance-workspace";
import { AttendanceTabs } from "@/components/attendance/attendance-tabs";
import { ClassAttendanceHeader } from "@/components/classes/class-attendance-header";
import { ClassAttendanceMemberView } from "@/components/classes/class-attendance-member-view";
import { getSessionUser } from "@/lib/auth/session";
import {
  getAttendanceCheckInView,
  getStudentAttendance,
} from "@/lib/db/attendance";
import {
  getStudentAttendanceMeetingView,
  listClassAttendanceMeetings,
} from "@/lib/db/attendance-meetings";
import { getClassAttendance } from "@/lib/db/class-attendance";
import {
  getClassBySlug,
  getClassRole,
  listClassMembers,
  listClassSubjects,
} from "@/lib/db/classes";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { attendanceQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Class attendance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ClassAttendancePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The attendance workspace of one class.
 *
 * It has its own route because the workspace is a fixed-height surface: the
 * page fills the viewport instead of growing with every session, and a
 * session opens as a panel over the workspace rather than below it.
 */
export default async function ClassAttendancePage({
  params,
  searchParams,
}: ClassAttendancePageProps) {
  const { slug } = await params;
  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/dashboard/classes/${slug}/attendance`));
  }

  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.isMember) {
    notFound();
  }

  const flat = flattenSearchParams(await searchParams);
  const memberView = flat.view === "history" ? "history" : "check-in";
  const base = `/dashboard/classes/${found.slug}/attendance`;

  let roleLabel = "Member";

  if (role.isAdmin) {
    roleLabel = "Class admin";
  } else if (role.isPlatformAdmin) {
    roleLabel = "Platform admin";
  }

  if (role.canManage) {
    const [subjects, meetings, classAttendance] = await Promise.all([
      listClassSubjects(found.id),
      listClassAttendanceMeetings(found.id),
      getClassAttendance(found.id),
    ]);

    return (
      <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
        <ClassAttendanceHeader
          classSummary={found}
          canManage
          isActive={found.status === "active"}
          roleLabel={roleLabel}
          hasElevatedRole={role.isAdmin || role.isPlatformAdmin}
          memberCount={classAttendance.members.length}
        />

        <ClassAttendanceWorkspace
          classSlug={found.slug}
          classId={found.id}
          subjects={subjects
            .filter((subject) => subject.id !== found.id)
            .map((subject) => ({
              id: subject.id,
              name: subject.name,
              code: subject.code,
            }))}
          meetings={meetings}
          members={classAttendance.members}
          sessions={classAttendance.sessions}
          bySubject={classAttendance.bySubject}
          summary={classAttendance.summary}
        />
      </div>
    );
  }

  const [ownAttendance, checkInView, meetingView, classMembers, classSubjects] =
    await Promise.all([
      getStudentAttendance(
        session.user.id,
        attendanceQuerySchema.parse({ class: found.id }),
      ),
      getAttendanceCheckInView(session.user.id, new Date(), {
        classId: found.id,
      }),
      getStudentAttendanceMeetingView(session.user.id),
      listClassMembers(found.id),
      listClassSubjects(found.id),
    ]);

  const subjects = classSubjects
    .filter((subject) => subject.id !== found.id)
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
    }));

  // The course filter narrows the member's own records; an unknown course
  // falls back to the unfiltered view instead of an empty page.
  const requestedSubjectId = flat.subject;
  const selectedCourseId =
    requestedSubjectId &&
    subjects.some((subject) => subject.id === requestedSubjectId)
      ? requestedSubjectId
      : null;

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <ClassAttendanceHeader
        classSummary={found}
        canManage={false}
        isActive={found.status === "active"}
        roleLabel={roleLabel}
        hasElevatedRole={role.isAdmin || role.isPlatformAdmin}
        memberCount={classMembers.length}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <AttendanceTabs
          activeTab={memberView}
          hrefFor={(tab) =>
            tab === "history" ? `${base}?view=history` : base
          }
        />

        <div className="mt-5">
          <AttendanceCourseFilter
            basePath={base}
            activeView={memberView}
            subjects={subjects}
            selectedCourseId={selectedCourseId}
          />
        </div>

        <ClassAttendanceMemberView
          view={ownAttendance}
          checkInView={checkInView}
          activeView={memberView}
          classSlug={found.slug}
          classId={found.id}
          meetings={meetingView.meetings.filter(
            (meeting) => meeting.classId === found.id,
          )}
          identity={meetingView.identity}
          selectedCourseId={selectedCourseId}
        />
      </div>
    </div>
  );
}
