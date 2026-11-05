import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ClassAttendanceMeetings } from "@/components/attendance/class-attendance-meetings";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { Alert } from "@/components/ui/alert";
import { requireCourseContext } from "@/features/classes/course-access";
import {
  getClassAttendanceRecap,
  getStudentAttendanceMeetingView,
  listClassAttendanceMeetings,
} from "@/lib/db/attendance-meetings";
import { listCourseComponentGrades } from "@/lib/db/course-grades";
import { ATTENDANCE_MEETING_PHASE_LABELS } from "@starstask/contracts";
import { formatDate, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Course attendance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseAttendancePageProps = {
  params: Promise<{ slug: string; courseId: string }>;
};

export default async function CourseAttendancePage({
  params,
}: CourseAttendancePageProps) {
  const { slug, courseId } = await params;
  const {
    session,
    class: found,
    role,
    course,
  } = await requireCourseContext(slug, courseId);

  const courseMeetings = role.canManage
    ? (await listClassAttendanceMeetings(found.id))
        .filter((meeting) => meeting.subjectId === course.id)
        .sort((left, right) => left.meetingNumber - right.meetingNumber)
    : [];
  const memberView = role.canManage
    ? null
    : await getStudentAttendanceMeetingView(session.user.id);
  const recap = role.canManage
    ? await getClassAttendanceRecap(found.id, course.id)
    : null;
  const componentGrades = role.canManage
    ? await listCourseComponentGrades(found.id, course.id)
    : {};
  const memberMeetings = (memberView?.meetings ?? []).filter(
    (meeting) =>
      meeting.classId === found.id && meeting.subjectId === course.id,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        activeTab="attendance"
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Attendance</h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {role.canManage
              ? "Meetings of this course only. Each meeting is stored with this course."
              : "Check in to open meetings of this course and review your own records."}
          </p>
        </div>
        <Link
          href={`/app/classes/${found.slug}/attendance?view=history`}
          className="text-accent text-sm font-medium hover:underline"
        >
          Class attendance history
        </Link>
      </div>

      {course.status === "archived" ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          This course is archived. Its attendance history is still available,
          but new meetings cannot be created.
        </Alert>
      ) : null}

      <div className="mt-5">
        {role.canManage && recap ? (
          <AttendanceSheet
            classSlug={found.slug}
            courseId={course.id}
            recap={recap}
            componentGrades={componentGrades}
            courseName={course.name}
            courseCode={course.code}
            className={found.name}
            semester={found.semester}
            academicYear={found.academic_year}
          />
        ) : null}
        {role.canManage ? (
          course.status === "active" ? (
            <ClassAttendanceMeetings
              classId={found.id}
              classSlug={found.slug}
              subjects={[
                { id: course.id, name: course.name, code: course.code },
              ]}
              meetings={courseMeetings}
            />
          ) : (
            <ArchivedMeetings meetings={courseMeetings} />
          )
        ) : (
          <StudentMeetingList
            meetings={memberMeetings}
            identity={memberView?.identity ?? { fullName: null, nim: null }}
          />
        )}
      </div>
    </div>
  );
}

function ArchivedMeetings({
  meetings,
}: {
  meetings: Awaited<ReturnType<typeof listClassAttendanceMeetings>>;
}) {
  if (meetings.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No attendance meeting was opened for this course.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {meetings.length} {pluralize(meetings.length, "meeting")} recorded.
      </p>
      <ul className="divide-border border-border mt-3 divide-y border-y">
        {meetings.map((meeting) => (
          <li
            key={meeting.sessionId}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4"
              />
              Pertemuan {meeting.meetingNumber} · {meeting.title}
            </span>
            <span className="text-muted-foreground text-xs">
              {meeting.meetingDate
                ? formatDate(meeting.meetingDate)
                : "No date"}
              {" · "}
              {ATTENDANCE_MEETING_PHASE_LABELS[meeting.phase]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
