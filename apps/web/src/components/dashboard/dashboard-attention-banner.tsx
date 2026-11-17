import Link from "next/link";

import { ArrowRight, TriangleAlert } from "lucide-react";

import { pluralize } from "@starstask/shared";

type DashboardAttentionBannerProps = {
  pastDeadline: number;
};

/**
 * Unobtrusive callout shown only when published tasks in the caller's classes
 * have slipped past their deadline. Hidden entirely when the count is zero,
 * so a healthy week stays quiet.
 */
export function DashboardAttentionBanner({
  pastDeadline,
}: DashboardAttentionBannerProps) {
  if (pastDeadline <= 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-danger/30 bg-danger-soft flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-3.5 py-2.5 sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="bg-surface text-danger flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">
            {pastDeadline} {pluralize(pastDeadline, "task")} past deadline
            <span className="text-muted-foreground ml-1.5 hidden font-normal sm:inline">
              Check whether any still accept late submissions.
            </span>
          </p>
        </div>
      </div>

      <Link
        href="/assignments?due=overdue"
        className="text-danger hover:text-danger/80 focus-visible:outline-accent inline-flex shrink-0 items-center gap-1.5 rounded-md text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-sm"
      >
        Review overdue
        <ArrowRight
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      </Link>
    </div>
  );
}
