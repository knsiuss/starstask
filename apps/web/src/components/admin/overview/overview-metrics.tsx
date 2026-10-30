import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  GraduationCap,
  ListChecks,
  Users,
} from "lucide-react";

import { AdminStatCard } from "@/components/admin/admin-stat-card";
import type { PlatformDashboardCounts } from "@/lib/db/class-submissions";

export function OverviewMetrics({
  counts,
  pendingActions,
}: {
  counts: PlatformDashboardCounts;
  pendingActions: number;
}) {
  return (
    <section
      aria-label="Platform metrics"
      className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <AdminStatCard
        label="Registered users"
        value={counts.totalUsers}
        hint={`${counts.onboardedUsers.toLocaleString()} finished onboarding · ${counts.platformAdmins.toLocaleString()} platform admin${counts.platformAdmins === 1 ? "" : "s"}`}
        icon={Users}
        href="/admin/users"
      />
      <AdminStatCard
        label="Active classes"
        value={counts.activeClasses}
        hint={`${counts.archivedClasses.toLocaleString()} archived`}
        icon={GraduationCap}
        href="/admin/classes?status=active"
      />
      <AdminStatCard
        label="Published assignments"
        value={counts.publishedAssignments}
        hint={`${counts.unpublishedAssignments.toLocaleString()} unpublished or archived`}
        icon={FileText}
        href="/admin/assignments?status=published"
      />
      <AdminStatCard
        label="Pending actions"
        value={pendingActions}
        hint={`${counts.pendingApplications.toLocaleString()} applications · ${counts.pendingVerifications.toLocaleString()} verifications · ${counts.pendingReviews.toLocaleString()} submissions`}
        icon={ListChecks}
        href="#attention"
        tone="attention"
      />

      <Link
        href="/admin/assignments?status=pending_review"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline sm:col-span-2 xl:col-span-4"
      >
        <ClipboardCheck
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
        {counts.pendingReviews.toLocaleString()} class submission
        {counts.pendingReviews === 1 ? " is" : "s are"} awaiting review
      </Link>
    </section>
  );
}
