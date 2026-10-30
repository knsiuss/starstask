import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { pluralize } from "@starstask/shared";

type DashboardAttentionBannerProps = {
  pastDeadline: number;
};

/**
 * Prominent callout shown only when published tasks in the caller's classes
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
      className="border-danger/30 bg-danger-soft mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border px-4 py-3.5 sm:px-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-surface text-danger flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        >
          <TriangleAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">
            {pastDeadline} {pluralize(pastDeadline, "task")} past deadline
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Deadlines that have already passed in your classes. Worth checking
            whether any of them still accept late work.
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/assignments?due=overdue"
        className="text-danger hover:text-danger/80 inline-flex shrink-0 items-center gap-1.5 rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Review overdue
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4"
        />
      </Link>
    </div>
  );
}
