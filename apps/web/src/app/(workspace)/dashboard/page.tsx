import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardAttendanceSection } from "@/components/dashboard/dashboard-attendance-section";
import { DashboardAttentionBanner } from "@/components/dashboard/dashboard-attention-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MyClassesSection } from "@/components/dashboard/my-classes-section";
import { MyWeekSection } from "@/components/dashboard/my-week-section";
import { NotificationsSection } from "@/components/dashboard/notifications-section";
import { PendingInvitationsSection } from "@/components/dashboard/pending-invitations-section";
import { PriorityTasksSection } from "@/components/dashboard/priority-tasks-section";
import { RecentTasksSection } from "@/components/dashboard/recent-tasks-section";
import { StatCards } from "@/components/dashboard/stat-cards";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAttendance } from "@/lib/db/attendance";
import {
  getDashboardOverview,
  getMyWeek,
  listPriorityTasks,
  listStudentPendingInvitations,
} from "@/lib/db/dashboard";
import { countPendingLeaveRequests } from "@/lib/db/leave";
import { listRecentNotifications } from "@/lib/db/notifications";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your classes, deadlines, and notifications on StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Bounded so a hand-edited query string cannot scan years of weeks. */
const MAX_WEEK_OFFSET = 52;

function parseWeekOffset(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed)) {
    return 0;
  }

  return Math.min(MAX_WEEK_OFFSET, Math.max(-MAX_WEEK_OFFSET, parsed));
}

function buildHeaderSummary(stats: {
  dueSoon: number;
  pastDeadline: number;
}): string | null {
  const parts: string[] = [];

  if (stats.dueSoon > 0) {
    parts.push(
      `${stats.dueSoon} ${pluralize(stats.dueSoon, "task")} due in the next 7 days`,
    );
  }

  if (stats.pastDeadline > 0) {
    parts.push(
      `${stats.pastDeadline} past ${stats.pastDeadline === 1 ? "deadline" : "deadlines"}`,
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return `You have ${parts.join(" and ")}.`;
}

type DashboardPageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard"));
  }

  const query = await searchParams;
  const weekOffset = parseWeekOffset(query.week);

  const [
    overview,
    pendingInvitations,
    week,
    priorityTasks,
    notifications,
    attendance,
    pendingAbsences,
  ] = await Promise.all([
    getDashboardOverview(session.user.id),
    listStudentPendingInvitations(session.user.id, session.user.email),
    getMyWeek(session.user.id, new Date(), weekOffset),
    listPriorityTasks(session.user.id),
    listRecentNotifications(5),
    getStudentAttendance(session.user.id, { status: "all" }),
    countPendingLeaveRequests(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <DashboardHeader
        displayName={session.profile?.display_name ?? null}
        initialNowIso={overview.nowIso}
        initialTimeZone={overview.timeZone}
        summary={buildHeaderSummary(overview.stats)}
      />

      <DashboardAttentionBanner pastDeadline={overview.stats.pastDeadline} />

      <PendingInvitationsSection initialInvitations={pendingInvitations} />

      <div className="mt-5">
        <StatCards stats={overview.stats} />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <MyWeekSection
            week={week}
            nowIso={overview.nowIso}
            weekOffset={weekOffset}
          />

          <MyClassesSection classes={overview.classes} />
        </div>

        <aside
          aria-label="At a glance"
          className="min-w-0 space-y-5"
        >
          <DashboardAttendanceSection
            summary={attendance.summary}
            pendingAbsences={pendingAbsences}
          />

          <PriorityTasksSection
            tasks={priorityTasks}
            nowIso={overview.nowIso}
          />

          <RecentTasksSection tasks={overview.recentTasks} />

          <NotificationsSection
            notifications={notifications}
            nowIso={overview.nowIso}
          />
        </aside>
      </div>
    </div>
  );
}
