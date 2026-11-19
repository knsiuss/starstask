import { AlertTriangle, ChartColumn } from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { type LecturerBapSummary } from "@/lib/lecturer/bap-progress";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

// Formatters are inlined on purpose: the shared module is a read-only
// reference for this job and must not gain a swarm dependency.
function formatRemainingToTarget(remainingToTarget: number): string {
  const remaining = Math.max(0, Math.trunc(remainingToTarget));

  return `${remaining} ${pluralize(remaining, "meeting")} to target`;
}

function formatBelowTargetPace(belowTargetCount: number): string {
  const count = Math.max(0, Math.trunc(belowTargetCount));

  return `Below target pace: ${count} ${pluralize(count, "course")}`;
}

const PANEL =
  "border-border bg-surface text-foreground dark:border-white/[0.06] dark:bg-[#23231f] dark:text-[#ece9e3]";
const MUTED_TEXT = "text-muted-foreground dark:text-[#aaa69e]";

type TeachingBapProgressProps = {
  summary: LecturerBapSummary | null;
};

/**
 * Meeting-target ledger for a lecturer's active offerings. Bar fill is
 * meetingsHeld / targetMeetings; BAP completion rides the same row.
 */
export function TeachingBapProgress({ summary }: TeachingBapProgressProps) {
  if (!summary) {
    return (
      <Alert variant="error">
        Could not load teaching progress. Try again in a moment.
      </Alert>
    );
  }

  return (
    <section
      aria-labelledby="teaching-bap-progress"
      className={cn("flex h-full flex-col rounded-xl border p-4 sm:p-5", PANEL)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="teaching-bap-progress"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <ChartColumn
            aria-hidden="true"
            className="h-4 w-4 text-[#5b6b45] dark:text-[#a3b07d]"
          />
          Teaching progress
        </h2>
        {summary.offerings.length > 0 ? (
          <Link
            href="/attendance"
            className="text-accent focus-visible:outline-accent inline-flex items-center rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#c3ccad]"
          >
            {summary.totalMeetingsWithBap}/{summary.totalMeetingsHeld} BAP
            recorded
          </Link>
        ) : null}
      </div>

      {summary.totalMissingBap > 0 ? (
        <p className="text-warning mt-2 flex items-start gap-1.5 text-xs font-medium dark:text-[#e8b84b]">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          <span>
            {summary.totalMissingBap}{" "}
            {pluralize(summary.totalMissingBap, "held meeting")} missing a BAP
            topic.
          </span>
        </p>
      ) : null}

      {summary.offerings.length > 0 && summary.belowTargetCount > 0 ? (
        <p className="text-warning mt-2 text-xs font-medium dark:text-[#e8b84b]">
          {formatBelowTargetPace(summary.belowTargetCount)}
        </p>
      ) : null}

      {summary.offerings.length === 0 ? (
        <div className="border-border mt-3 flex flex-1 items-center rounded-xl border border-dashed px-4 py-6 dark:border-white/[0.1]">
          <p className={cn("text-sm", MUTED_TEXT)}>
            No open course offerings yet.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex-1 divide-y divide-border dark:divide-white/[0.06]">
          {summary.offerings.map((item) => (
            <li
              key={item.offeringId}
              className="py-3 first:pt-0 last:pb-0"
            >
              <BapRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BapRow({ item }: { item: LecturerBapSummary["offerings"][number] }) {
  const percent =
    item.targetMeetings > 0
      ? Math.min(
          100,
          Math.round((item.meetingsHeld / item.targetMeetings) * 100),
        )
      : 0;
  const hasMissingBap = item.missingBapCount > 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              hasMissingBap ? "bg-[#e8b84b]" : "bg-[#5cb98a]",
            )}
          />
          <Link
            href={`/classes/${item.classSlug}/attendance`}
            className="text-foreground focus-visible:outline-accent truncate rounded-sm text-sm font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-[#ece9e3] dark:hover:text-[#c3ccad]"
          >
            {item.className}
          </Link>
          <span className={cn("shrink-0 truncate text-[11px]", MUTED_TEXT)}>
            {item.courseName}
          </span>
        </div>
        <span className="text-foreground shrink-0 text-xs font-semibold tabular-nums dark:text-[#ece9e3]">
          {percent}%
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="text-muted-foreground w-16 shrink-0 font-mono text-[11px] tabular-nums dark:text-[#b6b2a7]"
        >
          {item.meetingsHeld}/{item.targetMeetings}
        </span>
        <div
          className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full dark:bg-white/[0.08]"
          role="progressbar"
          aria-label={`${item.className} meeting progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full rounded-full bg-[#5b6b45] transition-[width] dark:bg-[#6f7f52]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px]">
        <span className={MUTED_TEXT}>
          <span
            className={cn(
              "font-medium",
              hasMissingBap ? "dark:text-[#e8b84b]" : "dark:text-[#5cb98a]",
            )}
          >
            BAP:{" "}
            {hasMissingBap ? `${item.missingBapCount} missing` : "Complete"}
          </span>
          <span aria-hidden="true"> · </span>
          {item.meetingsHeld}/{item.targetMeetings} meetings held
        </span>
        {item.isBelowTarget ? (
          <span className={MUTED_TEXT}>
            {formatRemainingToTarget(item.remainingToTarget)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
