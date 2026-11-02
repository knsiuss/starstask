import { ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClassAssignmentsTab } from "@/components/classes/class-assignments-tab";
import { ClassAttendanceTab } from "@/components/classes/class-attendance-tab";
import { ClassInfoTab } from "@/components/classes/class-info-tab";
import { ClassMembersTab } from "@/components/classes/class-members-tab";
import { ClassOverview } from "@/components/classes/class-overview";
import { ClassScheduleTab } from "@/components/classes/class-schedule-tab";
import { ClassWorkspaceActions } from "@/components/classes/class-workspace-actions";
import {
  ClassWorkspaceTabs,
  isClassTab,
  type ClassTab,
} from "@/components/classes/class-workspace-tabs";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AttendanceCheckInView } from "@/lib/attendance/types";
import type {
  AttendanceMeetingListItem,
  StudentAttendanceMeeting,
} from "@/lib/attendance/meeting-types";
import { getSessionUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import {
  getAttendanceCheckInView,
  getStudentAttendance,
  type StudentAttendanceView,
} from "@/lib/db/attendance";
import {
  getStudentAttendanceMeetingView,
  listClassAttendanceMeetings,
} from "@/lib/db/attendance-meetings";
import {
  getClassAttendance,
  type ClassAttendanceView,
} from "@/lib/db/class-attendance";
import { listClassSchedule } from "@/lib/db/class-schedule";
import { listMyClassSubmissions } from "@/lib/db/class-submissions";
import {
  getClassBySlug,
  getClassRole,
  listClassMembers,
  listClassSubjects,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import {
  attendanceQuerySchema,
  listAssignmentsQuerySchema,
} from "@starstask/contracts";
import { pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ClassDashboardProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AssignmentPage = Awaited<ReturnType<typeof listAssignments>>;
type SubmissionList = Awaited<ReturnType<typeof listMyClassSubmissions>>;
type ScheduleList = Awaited<ReturnType<typeof listClassSchedule>>;

export default async function ClassDashboardPage({
  params,
  searchParams,
}: ClassDashboardProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard"));
  }

  const { slug } = await params;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  // Membership is checked here for the page, but RLS is what actually keeps
  // these rows private for a non-member.
  if (!role.isMember) {
    notFound();
  }

  const rawQuery = await searchParams;
  const flatQuery = flattenSearchParams(rawQuery);

  if (flatQuery.tab && !isClassTab(flatQuery.tab)) {
    redirect(`/dashboard/classes/${found.slug}`);
  }

  // Courses live on their own route with nested course pages underneath it,
  // so the old `?tab=courses` links forward there instead of rendering inline.
  if (flatQuery.tab === "courses") {
    redirect(`/dashboard/classes/${found.slug}/courses`);
  }

  const selectedSubjectId = flatQuery.subject;
  let activeTab: ClassTab = "overview";

  if (isClassTab(flatQuery.tab)) {
    activeTab = flatQuery.tab;
  } else if (selectedSubjectId) {
    // Old subject-filter links had no tab, so keep them working.
    activeTab = "assignments";
  }

  const attendanceSubView =
    flatQuery.view === "history" ? "history" : "check-in";

  const [members, subjects] = await Promise.all([
    listClassMembers(found.id),
    listClassSubjects(found.id),
  ]);

  const selectedSubject =
    activeTab === "assignments" && selectedSubjectId
      ? subjects.find((subject) => subject.id === selectedSubjectId)
      : undefined;

  if (activeTab === "assignments" && selectedSubjectId && !selectedSubject) {
    redirect(`/dashboard/classes/${found.slug}?tab=assignments`);
  }

  let overviewAssignments: AssignmentPage["items"] = [];
  let assignmentsPage: AssignmentPage | null = null;
  let classSubmissions: SubmissionList = [];
  let scheduleEntries: ScheduleList = [];
  let classAttendance: ClassAttendanceView | null = null;
  let ownAttendance: StudentAttendanceView | null = null;
  let classCheckIn: AttendanceCheckInView | null = null;
  let classMeetings: AttendanceMeetingListItem[] = [];
  let memberMeetings: StudentAttendanceMeeting[] = [];
  let memberIdentity: { fullName: string | null; nim: string | null } = {
    fullName: null,
    nim: null,
  };

  if (activeTab === "overview") {
    const [recent, mine] = await Promise.all([
      listAssignments(
        listAssignmentsQuerySchema.parse({
          class: found.id,
          sort: "newest",
          page: 1,
          pageSize: 5,
        }),
      ),
      listMyClassSubmissions(session.user.id, found.id, 5),
    ]);

    overviewAssignments = recent.items;
    classSubmissions = mine;
  }

  if (activeTab === "assignments") {
    const parsedQuery = listAssignmentsQuerySchema.safeParse({
      class: found.id,
      course: selectedSubject?.course_id ?? undefined,
      sort: "newest",
      page: flatQuery.page ?? "1",
      pageSize: "20",
    });

    if (!parsedQuery.success) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <Alert variant="error">
            <p className="font-medium">That page is not valid.</p>
            <p className="mt-1">
              <Link
                href={`/dashboard/classes/${found.slug}?tab=assignments`}
                className="underline"
              >
                Return to the first page
              </Link>{" "}
              and try again.
            </p>
          </Alert>
        </div>
      );
    }

    const result = await listAssignments(parsedQuery.data);

    // Keep stale page numbers on real results rather than an empty final page.
    if (result.page > result.totalPages) {
      const params = new URLSearchParams({ tab: "assignments" });

      if (selectedSubjectId) {
        params.set("subject", selectedSubjectId);
      }

      if (result.totalPages > 1) {
        params.set("page", String(result.totalPages));
      }

      redirect(`/dashboard/classes/${found.slug}?${params.toString()}`);
    }

    assignmentsPage = result;
    classSubmissions = await listMyClassSubmissions(
      session.user.id,
      found.id,
      50,
    );
  }

  if (activeTab === "schedule") {
    scheduleEntries = await listClassSchedule(found.id);
  }

  if (activeTab === "attendance") {
    const checkIn = getAttendanceCheckInView(session.user.id, new Date(), {
      classId: found.id,
    });

    if (role.canManage) {
      [classAttendance, classCheckIn, classMeetings] = await Promise.all([
        getClassAttendance(found.id),
        checkIn,
        listClassAttendanceMeetings(found.id),
      ]);
    } else {
      const [own, check, meetingView] = await Promise.all([
        getStudentAttendance(
          session.user.id,
          attendanceQuerySchema.parse({ class: found.id }),
        ),
        checkIn,
        getStudentAttendanceMeetingView(session.user.id),
      ]);

      ownAttendance = own;
      classCheckIn = check;
      memberMeetings = meetingView.meetings.filter(
        (meeting) => meeting.classId === found.id,
      );
      memberIdentity = meetingView.identity;
    }
  }

  let roleLabel = "Member";

  if (role.isAdmin) {
    roleLabel = "Class admin";
  } else if (role.isPlatformAdmin) {
    roleLabel = "Platform admin";
  }

  const hasElevatedRole = role.isAdmin || role.isPlatformAdmin;

  const attendanceClassInfo = {
    id: found.id,
    slug: found.slug,
    semester: found.semester,
    academicYear: found.academic_year,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
      >
        <Link
          href="/dashboard"
          className="hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Dashboard
        </Link>
        <ChevronRight
          className="text-muted-foreground/60 h-3.5 w-3.5"
          aria-hidden="true"
        />
        <Link
          href="/classes"
          className="hover:text-foreground"
        >
          My Classes
        </Link>
        <ChevronRight
          className="text-muted-foreground/60 h-3.5 w-3.5"
          aria-hidden="true"
        />
        {selectedSubject ? (
          <>
            <Link
              href={`/dashboard/classes/${found.slug}`}
              className="hover:text-foreground"
            >
              {found.name}
            </Link>
            <ChevronRight
              className="text-muted-foreground/60 h-3.5 w-3.5"
              aria-hidden="true"
            />
            <span className="text-foreground font-medium">
              {selectedSubject.name}
            </span>
          </>
        ) : (
          <span className="text-foreground font-medium">{found.name}</span>
        )}
      </nav>

      {flatQuery.posted ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          <p className="font-medium">Your post is published.</p>
          <p className="mt-1">
            Members with notifications enabled were alerted, and the assignment
            is already visible on the public class page.
          </p>
        </Alert>
      ) : null}

      {flatQuery.submitted ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Submission received. A class admin will review it before it becomes
          public.
        </Alert>
      ) : null}

      {flatQuery.revised ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Revision saved and returned to the review queue.
        </Alert>
      ) : null}

      {found.status === "archived" ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          This class is archived. It is hidden from public discovery and no
          longer accepts new submissions.
        </Alert>
      ) : null}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={found.status} />
            <Badge variant={hasElevatedRole ? "accent" : "neutral"}>
              {role.isAdmin ? (
                <ShieldCheck
                  aria-hidden="true"
                  className="h-3 w-3"
                />
              ) : null}
              {roleLabel}
            </Badge>
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {found.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="text-foreground font-medium">
              {found.course_name}
            </span>
            <span
              aria-hidden="true"
              className="mx-1.5"
            >
              ·
            </span>
            {found.class_code ? `${found.class_code} · ` : ""}
            {found.semester} {found.academic_year}
            <span
              aria-hidden="true"
              className="mx-1.5"
            >
              ·
            </span>
            {members.length} {pluralize(members.length, "member")}
            {found.lecturer_name ? (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1.5"
                >
                  ·
                </span>
                {found.lecturer_name}
              </>
            ) : null}
          </p>
        </div>

        <ClassWorkspaceActions
          classSlug={found.slug}
          canManage={role.canManage}
          isActive={found.status === "active"}
        />
      </header>

      <ClassWorkspaceTabs
        slug={found.slug}
        activeTab={activeTab}
      />

      {activeTab === "overview" ? (
        <ClassOverview
          classSummary={found}
          recentAssignments={overviewAssignments}
          submissions={classSubmissions}
          canManage={role.canManage}
        />
      ) : null}

      {activeTab === "info" ? (
        <ClassInfoTab
          classSummary={found}
          members={members}
          courses={subjects}
          canManage={role.canManage}
        />
      ) : null}

      {activeTab === "assignments" && assignmentsPage ? (
        <ClassAssignmentsTab
          classSlug={found.slug}
          canManage={role.canManage}
          assignments={assignmentsPage.items}
          page={assignmentsPage.page}
          totalPages={assignmentsPage.totalPages}
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          submissions={classSubmissions}
        />
      ) : null}

      {activeTab === "members" ? (
        <ClassMembersTab
          classSlug={found.slug}
          members={members}
          canManage={role.canManage}
          currentUserId={session.user.id}
        />
      ) : null}

      {activeTab === "schedule" ? (
        <ClassScheduleTab
          classSlug={found.slug}
          subjects={subjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
            lecturer_name: subject.lecturer_name,
          }))}
          entries={scheduleEntries}
        />
      ) : null}

      {activeTab === "attendance" && classAttendance && classCheckIn ? (
        <ClassAttendanceTab
          role="manager"
          classInfo={attendanceClassInfo}
          activeView={attendanceSubView}
          view={classAttendance}
          checkInView={classCheckIn}
          meetings={classMeetings}
          subjects={subjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
            code: subject.code,
          }))}
        />
      ) : null}

      {activeTab === "attendance" && ownAttendance && classCheckIn ? (
        <ClassAttendanceTab
          role="member"
          classInfo={attendanceClassInfo}
          activeView={attendanceSubView}
          view={ownAttendance}
          checkInView={classCheckIn}
          meetings={memberMeetings}
          identity={memberIdentity}
        />
      ) : null}
    </div>
  );
}
