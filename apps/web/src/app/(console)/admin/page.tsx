import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ActivityColumn } from "@/components/admin/overview/activity-column";
import { ModerationPanel } from "@/components/admin/overview/moderation-panel";
import { OverviewMetrics } from "@/components/admin/overview/overview-metrics";
import { PendingApplicationsPanel } from "@/components/admin/overview/pending-applications-panel";
import { PendingVerificationsPanel } from "@/components/admin/overview/pending-verifications-panel";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  getPlatformDashboardCounts,
  listPlatformModerationQueue,
} from "@/lib/db/class-submissions";
import {
  listApplicationsForReview,
  listAuditLogs,
  loadProfiles,
} from "@/lib/db/classes";
import { listVerificationQueue } from "@/lib/db/verification";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Platform overview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ decided?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin");

  const [
    counts,
    pendingApplications,
    pendingVerifications,
    moderation,
    audit,
    query,
  ] = await Promise.all([
    getPlatformDashboardCounts(),
    listApplicationsForReview({ status: "pending", page: 1, pageSize: 5 }),
    listVerificationQueue({ status: "pending", page: 1, pageSize: 4 }),
    listPlatformModerationQueue(4),
    listAuditLogs({ page: 1, pageSize: 6 }),
    searchParams,
  ]);

  const applicantProfiles = await loadProfiles(
    pendingApplications.items.map((application) => application.applicant_id),
  );

  const pendingActions =
    counts.pendingApplications +
    counts.pendingVerifications +
    counts.pendingReviews;

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        description="Platform-wide state of accounts, classes, and published work. Counters are computed by the database and every list links to its working queue."
        actions={
          <Button
            asChild
            variant="secondary"
          >
            <Link href="/classes/discover">View public site</Link>
          </Button>
        }
      />

      {query.decided ? (
        <Alert
          variant={query.decided === "approved" ? "success" : "info"}
          className="mt-5"
        >
          {query.decided === "approved"
            ? "Class application approved."
            : "Class application rejected and the applicant notified."}
        </Alert>
      ) : null}

      <OverviewMetrics
        counts={counts}
        pendingActions={pendingActions}
      />

      <div
        id="attention"
        className="mt-8 grid gap-6 lg:grid-cols-3"
      >
        <PendingApplicationsPanel
          items={pendingApplications.items}
          total={pendingApplications.total}
          applicants={applicantProfiles}
        />
        <PendingVerificationsPanel items={pendingVerifications.items} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <ModerationPanel items={moderation} />
        <ActivityColumn
          audit={audit.items}
          counts={counts}
        />
      </div>
    </div>
  );
}
