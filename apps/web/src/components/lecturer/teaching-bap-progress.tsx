import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import type { LecturerBapSummary } from "@/lib/lecturer/bap-progress";
import { pluralize } from "@starstask/shared";

type TeachingBapProgressProps = {
  summary: LecturerBapSummary | null;
};

/**
 * Compact ledger of semester meeting counts (vs 14-16 target) and BAP topic
 * completion across a lecturer's active offerings.
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
    <section aria-labelledby="teaching-bap-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="teaching-bap-progress"
          className="text-base font-semibold tracking-tight"
        >
          Meetings &amp; BAP
        </h2>
        {summary.offerings.length > 0 ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            {summary.totalMeetingsWithBap}/{summary.totalMeetingsHeld} BAP
            recorded
          </p>
        ) : null}
      </div>

      {summary.totalMissingBap > 0 ? (
        <p className="text-warning mt-2 text-xs font-medium">
          {summary.totalMissingBap}{" "}
          {pluralize(summary.totalMissingBap, "held meeting")} missing a BAP
          topic.
        </p>
      ) : null}

      {summary.offerings.length === 0 ? (
        <div className="border-border bg-surface mt-3 rounded-xl border px-4 py-4">
          <p className="text-muted-foreground text-sm">
            No open course offerings yet.
          </p>
        </div>
      ) : (
        <ul className="border-border bg-surface divide-border mt-3 divide-y overflow-hidden rounded-xl border">
          {summary.offerings.map((item) => {
            const percent =
              item.targetMeetings > 0
                ? Math.min(
                    100,
                    Math.round((item.meetingsHeld / item.targetMeetings) * 100),
                  )
                : 0;

            return (
              <li
                key={item.offeringId}
                className="px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/classes/${item.classSlug}/attendance`}
                      className="hover:text-accent focus-visible:outline-accent block truncate rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {item.courseName}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.className}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-foreground text-xs font-medium tabular-nums">
                      {item.meetingsHeld}/{item.targetMeetings}
                    </span>
                    {item.missingBapCount > 0 ? (
                      <p className="text-warning text-[11px]">
                        {item.missingBapCount} missing BAP
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="bg-muted mt-2 h-1 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-accent h-full rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
