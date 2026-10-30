import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardAttentionBanner } from "@/components/dashboard/dashboard-attention-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MyClassesSection } from "@/components/dashboard/my-classes-section";
import { MyWeekSection } from "@/components/dashboard/my-week-section";
import { NotificationsSection } from "@/components/dashboard/notifications-section";
import { PendingInvitationsSection } from "@/components/dashboard/pending-invitations-section";
import { PriorityTasksSection } from "@/components/dashboard/priority-tasks-section";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentTasksSection } from "@/components/dashboard/recent-tasks-section";
import { StatCards } from "@/components/dashboard/stat-cards";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import {
  getDashboardOverview,
  getMyWeek,
  listMyNotifications,
  listPriorityTasks,
  listStudentPendingInvitations,
} from "@/lib/db/dashboard";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your classes, deadlines, and notifications on StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

export default async function DashboardPage() {
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

  const [overview, pendingInvitations, week, priorityTasks, notifications] =
    await Promise.all([
      getDashboardOverview(session.user.id),
      listStudentPendingInvitations(session.user.id, session.user.email),
      getMyWeek(session.user.id),
      listPriorityTasks(session.user.id),
      listMyNotifications(),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <DashboardHeader
        displayName={session.profile?.display_name ?? null}
        initialNowIso={overview.nowIso}
        initialTimeZone={overview.timeZone}
        summary={buildHeaderSummary(overview.stats)}
      />

      <DashboardAttentionBanner pastDeadline={overview.stats.pastDeadline} />

      <StatCards stats={overview.stats} />

      <QuickActions pendingInvitationsCount={pendingInvitations.length} />

      <PriorityTasksSection
        tasks={priorityTasks}
        nowIso={overview.nowIso}
      />

      <MyWeekSection
        week={week}
        nowIso={overview.nowIso}
      />

      <PendingInvitationsSection initialInvitations={pendingInvitations} />

      <NotificationsSection notifications={notifications} />

      <MyClassesSection classes={overview.classes} />

      <RecentTasksSection
        tasks={overview.recentTasks}
        nowIso={overview.nowIso}
      />
    </div>
  );
}
