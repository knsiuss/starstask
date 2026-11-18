import type { Metadata } from "next";
import * as React from "react";
import { redirect } from "next/navigation";

import { AcademicContextCard } from "@/components/dashboard/academic-context-card";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import {
  HeaderSection,
  InvitationsSection,
  ScheduleSection,
  WeekAndClassesSection,
} from "@/components/dashboard/dashboard-sections";
import { WhatsNewBanner } from "@/components/dashboard/whats-new-banner";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { isLecturer } from "@/lib/auth/lecturer";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

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

type DashboardPageProps = {
  searchParams: Promise<{ week?: string; view?: string }>;
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

  // A lecturer opens the app to answer a different question than a student, so
  // they land on `/lecturer`. `?view=student` stays available for lecturers who
  // are also enrolled somewhere.
  if (query.view !== "student" && (await isLecturer())) {
    redirect("/lecturer");
  }

  return (
    <PullToRefresh>
      <PageShell width="canvas">
        <DashboardRealtime />
        <React.Suspense
          fallback={
            <div className="space-y-3">
              <div className="skeleton h-[76px] rounded-xl" />
              <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                <div className="skeleton h-[76px] rounded-xl sm:h-[84px]" />
                <div className="skeleton h-[76px] rounded-xl sm:h-[84px]" />
                <div className="skeleton h-[76px] rounded-xl sm:h-[84px]" />
                <div className="skeleton h-[76px] rounded-xl sm:h-[84px]" />
              </div>
            </div>
          }
        >
          <HeaderSection
            userId={session.user.id}
            displayName={session.profile?.display_name ?? null}
          />
        </React.Suspense>

        <WhatsNewBanner />

        <div className="mt-5 space-y-5">
          <React.Suspense fallback={null}>
            <InvitationsSection
              userId={session.user.id}
              email={session.user.email ?? ""}
            />
          </React.Suspense>

          <React.Suspense fallback={null}>
            <AcademicContextCard />
          </React.Suspense>

          <React.Suspense
            fallback={<div className="skeleton h-24 rounded-xl" />}
          >
            <ScheduleSection userId={session.user.id} />
          </React.Suspense>

          <React.Suspense
            fallback={
              <div className="space-y-5">
                <div className="skeleton hidden h-56 rounded-xl sm:block" />
                <div className="skeleton h-48 rounded-xl" />
              </div>
            }
          >
            <WeekAndClassesSection
              userId={session.user.id}
              weekOffset={weekOffset}
            />
          </React.Suspense>
        </div>
      </PageShell>
    </PullToRefresh>
  );
}
