import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AssignmentReportCard } from "@/components/admin/assignment-report-card";
import { SetupNotice } from "@/components/layout/setup-notice";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listAssignmentReports } from "@/lib/db/assignment-trust";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  ASSIGNMENT_REPORT_STATUSES,
  type AssignmentReportStatus,
} from "@starstask/contracts";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Assignment reports",
  description:
    "Reader-submitted corrections for the public assignment archive.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

type StatusFilter = AssignmentReportStatus | "all";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

function parseStatus(value: string | undefined): StatusFilter {
  if (value === "all") {
    return "all";
  }

  if (
    value &&
    (ASSIGNMENT_REPORT_STATUSES as readonly string[]).includes(value)
  ) {
    return value as AssignmentReportStatus;
  }

  return "open";
}

/**
 * Trust-loop queue: readers flag a wrong brief, an operator closes the loop.
 *
 * The queue is platform-admin only. Class admins act through the same database
 * function, but the console stays a single place to see every open report.
 */
export default async function AdminReportsPage({
  searchParams,
}: ReportsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Assignment reports
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  await requirePlatformAdmin("/admin/reports");

  const { status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);
  const queue = await listAssignmentReports(status);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Assignment reports"
        description="Corrections submitted from assignment pages. Resolve a report when the brief is fixed, or dismiss it when the report is wrong."
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "open"
                ? "/admin/reports"
                : `/admin/reports?status=${filter.value}`
            }
            aria-current={status === filter.value ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === filter.value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {filter.label}
          </Link>
        ))}

        <span className="text-muted-foreground ml-auto text-xs">
          {queue.openCount} open
        </span>
      </div>

      {queue.items.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border px-6 py-12 text-center">
          <p className="text-sm font-medium">No reports here</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
            {status === "open"
              ? "Nothing needs attention right now. Readers can report a problem from any published assignment."
              : "No reports match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.items.map((report) => (
            <AssignmentReportCard
              key={report.id}
              report={report}
            />
          ))}
        </div>
      )}
    </div>
  );
}
