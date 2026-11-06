import dynamic from "next/dynamic";
import * as React from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MyClassesSection } from "@/components/dashboard/my-classes-section";
import { NextSchedule } from "@/components/dashboard/next-schedule";
import { StatCards } from "@/components/dashboard/stat-cards";
import { DashboardAttentionBanner } from "@/components/dashboard/dashboard-attention-banner";
import {
  getDashboardOverview,
  getMyWeek,
  getNextSchedule,
  listStudentPendingInvitations,
} from "@/lib/db/dashboard";

// Interactive sections below the fold ship as separate chunks so the
// dashboard's first paint does not wait for them.
const MyWeekSection = dynamic(
  () =>
    import("@/components/dashboard/my-week-section").then(
      (module) => module.MyWeekSection,
    ),
  {
    loading: () => <div className="h-48 animate-pulse rounded bg-muted" />,
  },
);

const PendingInvitationsSection = dynamic(
  () =>
    import("@/components/dashboard/pending-invitations-section").then(
      (module) => module.PendingInvitationsSection,
    ),
  { loading: () => null },
);
function pluralize(count: number, singular: string) {
  return `${count} ${singular}`;
}
function buildHeaderSummary(stats: {
  dueSoon: number;
  pastDeadline: number;
}): string | null {
  const parts: string[] = [];
  if (stats.dueSoon > 0)
    parts.push(
      `${stats.dueSoon} ${pluralize(stats.dueSoon, "task")} due in the next 7 days`,
    );
  if (stats.pastDeadline > 0)
    parts.push(
      `${stats.pastDeadline} past ${stats.pastDeadline === 1 ? "deadline" : "deadlines"}`,
    );
  return parts.length ? `You have ${parts.join(" and ")}.` : null;
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
    <>
      <DashboardHeader
        displayName={displayName}
        initialNowIso={overview.nowIso}
        initialTimeZone={overview.timeZone}
        summary={buildHeaderSummary(overview.stats)}
      />
      <DashboardAttentionBanner pastDeadline={overview.stats.pastDeadline} />
      <div className="mt-5">
        <StatCards stats={overview.stats} />
      </div>
    </>
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
  return (
    <div className="mt-5">
      <NextSchedule item={item} />
    </div>
  );
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
    <div
      className="mt-5 space-y-5"
      style={{ "--rise-delay": "120ms" } as React.CSSProperties}
    >
      <MyWeekSection
        week={week}
        nowIso={overview.nowIso}
        weekOffset={weekOffset}
        canScheduleSessions={overview.classes.some((c) => c.is_admin)}
      />
      <MyClassesSection classes={overview.classes} />
    </div>
  );
}
