import type { Metadata } from "next";
import type { CSSProperties } from "react";
import * as React from "react";
import { redirect } from "next/navigation";

import { AcademicContextCard } from "@/components/dashboard/academic-context-card";
import { UnpamWidget } from "@/components/dashboard/unpam-widget";
import {
  HeaderSection,
  InvitationsSection,
  ScheduleSection,
  WeekAndClassesSection,
} from "@/components/dashboard/dashboard-sections";
import { DashboardAttentionBanner } from "@/components/dashboard/dashboard-attention-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { MyClassesSection } from "@/components/dashboard/my-classes-section";
import { MyWeekSection } from "@/components/dashboard/my-week-section";
import { NextSchedule } from "@/components/dashboard/next-schedule";
import { PendingInvitationsSection } from "@/components/dashboard/pending-invitations-section";
import { StatCards } from "@/components/dashboard/stat-cards";
import { WhatsNewBanner } from "@/components/dashboard/whats-new-banner";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getSessionUser } from "@/lib/auth/session";
import {
  getDashboardOverview,
  getMyWeek,
  getNextSchedule,
  listStudentPendingInvitations,
} from "@/lib/db/dashboard";
import { isSupabaseConfigured } from "@/lib/env/public";
import { isUnpamPluginEnabled } from "@/features/plugins/unpam/config";
import { getPersistedUnpamEvents, isUnpamMember } from "@/lib/db/plugins";
import { getMyProfile } from "@/lib/db/profiles";
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
    redirect(buildLoginPath("/app"));
  }

  const query = await searchParams;
  const weekOffset = parseWeekOffset(query.week);

  // Streaming: page shell + auth langsung, section berat di-Suspense terpisah.
  // TTFB turun karena tidak nunggu overview/week/schedule selesai.
  const [myProfile, unpamMember] = await Promise.all([
    getMyProfile().catch(() => null),
    isUnpamPluginEnabled()
      ? isUnpamMember(session.user.id, null).catch(() => false)
      : Promise.resolve(false),
  ]);
  const showUnpamWidget = unpamMember || (await isUnpamMember(session.user.id, myProfile?.university));
  const unpamEvents = showUnpamWidget ? await getPersistedUnpamEvents() : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <React.Suspense fallback={<div className="h-24 animate-pulse rounded bg-muted" />}>
        <HeaderSection userId={session.user.id} displayName={session.profile?.display_name ?? null} />
      </React.Suspense>

      <WhatsNewBanner />

      <div className="mt-5">
        <QuickActions />
      </div>

      <React.Suspense fallback={null}>
        <InvitationsSection userId={session.user.id} email={session.user.email ?? ""} />
      </React.Suspense>

      <div className="mt-5">
        <React.Suspense fallback={null}>
          <AcademicContextCard />
        </React.Suspense>
      </div>

      {showUnpamWidget ? (
        <div className="mt-5">
          <UnpamWidget events={unpamEvents} />
        </div>
      ) : null}

      <React.Suspense fallback={<div className="mt-5 h-20 animate-pulse rounded bg-muted" />}>
        <ScheduleSection userId={session.user.id} />
      </React.Suspense>

      <React.Suspense fallback={<div className="mt-5 h-64 animate-pulse rounded bg-muted" />}>
        <WeekAndClassesSection userId={session.user.id} weekOffset={weekOffset} />
      </React.Suspense>
    </div>
  );
}
