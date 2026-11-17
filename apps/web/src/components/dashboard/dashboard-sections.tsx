import * as React from "react";
import dynamic from "next/dynamic";

import { DashboardAttentionBanner } from "@/components/dashboard/dashboard-attention-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MyClassesSection } from "@/components/dashboard/my-classes-section";
import { NextSchedule } from "@/components/dashboard/next-schedule";
import { StatCards } from "@/components/dashboard/stat-cards";
import {
  getDashboardOverview,
  getMyWeek,
  getNextSchedule,
  listStudentPendingInvitations,
} from "@/lib/db/dashboard";
import { pluralize } from "@starstask/shared";

// Interactive sections below the fold ship as separate chunks so the
// dashboard's first paint does not wait for them.
const MyWeekSection = dynamic(
  () =>
    import("@/components/dashboard/my-week-section").then(
      (module) => module.MyWeekSection,
    ),
  {
    loading: () => <div className="skeleton h-48 rounded-xl" />,
  },
);

const PendingInvitationsSection = dynamic(
  () =>
    import("@/components/dashboard/pending-invitations-section").then(
      (module) => module.PendingInvitationsSection,
    ),
  { loading: () => null },
);

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

export async function HeaderSection({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string | null;
}) {
  const overview = await getDashboardOverview(userId);

  return (
    <section
      aria-label="Dashboard overview"
      className="space-y-3"
    >
      <DashboardHeader
        displayName={displayName}
        initialNowIso={overview.nowIso}
        initialTimeZone={overview.timeZone}
        summary={buildHeaderSummary(overview.stats)}
      />
      <DashboardAttentionBanner pastDeadline={overview.stats.pastDeadline} />
      <StatCards stats={overview.stats} />
    </section>
  );
}

export async function InvitationsSection({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const invitations = await listStudentPendingInvitations(userId, email);

  return <PendingInvitationsSection initialInvitations={invitations} />;
}

export async function ScheduleSection({ userId }: { userId: string }) {
  const item = await getNextSchedule(userId);

  return <NextSchedule item={item} />;
}

export async function WeekAndClassesSection({
  userId,
  weekOffset,
}: {
  userId: string;
  weekOffset: number;
}) {
  const [week, overview] = await Promise.all([
    getMyWeek(userId, new Date(), weekOffset),
    getDashboardOverview(userId),
  ]);

  return (
    <div className="space-y-5">
      <div className="hidden sm:block">
        <MyWeekSection
          week={week}
          nowIso={overview.nowIso}
          weekOffset={weekOffset}
          canScheduleSessions={overview.classes.some((c) => c.is_admin)}
        />
      </div>
      <MyClassesSection classes={overview.classes} />
    </div>
  );
}
