import type { Metadata } from "next";
import type { CSSProperties } from "react";
import * as React from "react";
import { redirect } from "next/navigation";

import { AcademicContextCard } from "@/components/dashboard/academic-context-card";
import { DashboardAttentionBanner } from "@/components/dashboard/dashboard-attention-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MyClassesSection } from "@/components/dashboard/my-classes-section";
import { MyWeekSection } from "@/components/dashboard/my-week-section";
import { NextSchedule } from "@/components/dashboard/next-schedule";
import { PendingInvitationsSection } from "@/components/dashboard/pending-invitations-section";
import { StatCards } from "@/components/dashboard/stat-cards";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import {
  getDashboardOverview,
  getMyWeek,
  getNextSchedule,
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

  const [overview, pendingInvitations, week, nextSchedule] = await Promise.all([
    getDashboardOverview(session.user.id),
    listStudentPendingInvitations(session.user.id, session.user.email),
    getMyWeek(session.user.id, new Date(), weekOffset),
    getNextSchedule(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <DashboardHeader
        displayName={session.profile?.display_name ?? null}
        initialNowIso={overview.nowIso}
        initialTimeZone={overview.timeZone}
        summary={buildHeaderSummary(overview.stats)}
      />

      <DashboardAttentionBanner pastDeadline={overview.stats.pastDeadline} />

      <PendingInvitationsSection initialInvitations={pendingInvitations} />

      <div className="mt-5">
        <React.Suspense fallback={null}>
          <AcademicContextCard />
        </React.Suspense>
      </div>

      <div
        className="mt-5"
        style={{ "--rise-delay": "0ms" } as CSSProperties}
      >
        <StatCards stats={overview.stats} />
      </div>

      <div className="mt-5">
        <NextSchedule item={nextSchedule} />
      </div>

      <div
        className="mt-5 space-y-5"
        style={{ "--rise-delay": "120ms" } as CSSProperties}
      >
        <MyWeekSection
          week={week}
          nowIso={overview.nowIso}
          weekOffset={weekOffset}
          canScheduleSessions={overview.classes.some(
            (classItem) => classItem.is_admin,
          )}
        />

        <MyClassesSection classes={overview.classes} />
      </div>
    </div>
  );
}
