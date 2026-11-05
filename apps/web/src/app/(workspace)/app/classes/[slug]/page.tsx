import { ArrowLeft, ChevronRight, House } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClassAssignmentsTab } from "@/components/classes/class-assignments-tab";
import { ClassInfoTab } from "@/components/classes/class-info-tab";
import { ClassMembersTab } from "@/components/classes/class-members-tab";
import { ClassOverview } from "@/components/classes/class-overview";
import { ClassScheduleTab } from "@/components/classes/class-schedule-tab";
import { ClassIdentityHeader } from "@/components/classes/overview/class-identity-header";
import { ClassWorkspaceActions } from "@/components/classes/class-workspace-actions";
import {
  ClassWorkspaceTabs,
  isClassTab,
  type ClassTab,
} from "@/components/classes/class-workspace-tabs";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getClassOverviewData } from "@/lib/db/class-overview";
import { listAssignments } from "@/lib/db/assignments";
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
import { listAssignmentsQuerySchema } from "@starstask/contracts";

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
    redirect(buildLoginPath("/app"));
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
    redirect(`/app/classes/${found.slug}`);
  }

  // Courses live on their own route with nested course pages underneath it,
  // so the old `?tab=courses` links forward there instead of rendering inline.
  if (flatQuery.tab === "courses") {
    redirect(`/app/classes/${found.slug}/courses`);
  }

  // Attendance owns a fixed-viewport workspace of its own, so the old inline
  // tab links forward to that route and keep their sub-view.
  if (flatQuery.tab === "attendance") {
    const suffix = flatQuery.view === "history" ? "?view=history" : "";

    redirect(`/app/classes/${found.slug}/attendance${suffix}`);
  }

  const selectedSubjectId = flatQuery.subject;
  let activeTab: ClassTab = "overview";

  if (isClassTab(flatQuery.tab)) {
    activeTab = flatQuery.tab;
  } else if (selectedSubjectId) {
    // Old subject-filter links had no tab, so keep them working.
    activeTab = "assignments";
  }

  const [members, subjects] = await Promise.all([
    listClassMembers(found.id),
    listClassSubjects(found.id),
  ]);

  // The assignments tab narrows to one course of the class.
  const usesSubjectFilter = activeTab === "assignments";

  const selectedSubject =
    usesSubjectFilter && selectedSubjectId
      ? subjects.find((subject) => subject.id === selectedSubjectId)
      : undefined;

  if (usesSubjectFilter && selectedSubjectId && !selectedSubject) {
    redirect(`/app/classes/${found.slug}?tab=${activeTab}`);
  }

  let overviewData: Awaited<ReturnType<typeof getClassOverviewData>> | null =
    null;
  let assignmentsPage: AssignmentPage | null = null;
  let classSubmissions: SubmissionList = [];
  let scheduleEntries: ScheduleList = [];

  if (activeTab === "overview") {
    overviewData = await getClassOverviewData(found.id, session.user.id);
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
                href={`/app/classes/${found.slug}?tab=assignments`}
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

      redirect(`/app/classes/${found.slug}?${params.toString()}`);
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

  let roleLabel = "Member";

  if (role.isAdmin) {
    roleLabel = "Class admin";
  } else if (role.isPlatformAdmin) {
    roleLabel = "Platform admin";
  }

  const hasElevatedRole = role.isAdmin || role.isPlatformAdmin;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
      >
        <Link
          href="/app"
          className="hover:text-foreground inline-flex items-center gap-1.5"
        >
          <House
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Home
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
              href={`/app/classes/${found.slug}`}
              className="hover:text-foreground"
            >
              {found.class_code ?? found.name}
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
          <span className="text-foreground font-medium">
            {found.class_code ?? found.name}
          </span>
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

      <div className="mt-4">
        <ClassIdentityHeader
          classSummary={found}
          memberCount={members.length}
          roleLabel={roleLabel}
          hasElevatedRole={hasElevatedRole}
        />
      </div>

      <div className="mt-4">
        <ClassWorkspaceActions
          classSlug={found.slug}
          canManage={role.canManage}
          isActive={found.status === "active"}
        />
      </div>

      <ClassWorkspaceTabs
        slug={found.slug}
        activeTab={activeTab}
      />

      {activeTab === "overview" && overviewData ? (
        <ClassOverview
          classSlug={found.slug}
          data={overviewData}
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
          memberCount={members.length}
          canCreateCourses={role.canManage}
        />
      ) : null}
    </div>
  );
}
