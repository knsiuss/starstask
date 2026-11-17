import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { formatRemainingTime } from "@/lib/assignments/workspace";
import type { WorkspaceOverview } from "@/lib/db/assignment-workspace";

function Stat({
  label,
  shortLabel,
  value,
  tone,
}: {
  label: string;
  shortLabel: string;
  value: number;
  tone: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "danger"
        ? "text-danger"
        : "text-accent";

  return (
    <li className="flex min-w-0 flex-col items-center gap-0.5 px-2 py-0.5 text-center lg:flex-row lg:items-baseline lg:justify-between lg:px-0 lg:py-2.5 lg:text-left lg:first:pt-0 lg:last:pb-0">
      <span className="text-muted-foreground order-2 text-xs leading-tight lg:order-1 lg:text-sm">
        <span className="lg:hidden">{shortLabel}</span>
        <span className="hidden lg:inline">{label}</span>
      </span>
      <span
        className={`order-1 text-xl font-semibold tracking-tight tabular-nums lg:order-2 lg:text-2xl ${toneClass}`}
      >
        {value}
      </span>
    </li>
  );
}

/**
 * Overview numbers plus (on desktop) the nearest upcoming deadlines, from
 * the same visible published set as the schedule list. `idPrefix` keeps
 * heading ids unique across the mobile and desktop instances.
 */
export function OverviewSidebar({
  overview,
  idPrefix,
}: {
  overview: WorkspaceOverview;
  idPrefix: string;
}) {
  const now = new Date();

  return (
    <aside className="space-y-4">
      <section
        aria-labelledby={`${idPrefix}-overview`}
        className="border-border bg-surface rounded-xl border p-3.5 sm:p-4 lg:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id={`${idPrefix}-overview`}
            className="text-foreground text-sm font-semibold tracking-tight"
          >
            Overview
          </h2>
          <Link
            href="/schedule"
            className="text-accent hover:text-accent-hover inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-xs font-semibold transition-colors lg:hidden"
          >
            Schedule
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        </div>
        <ul className="divide-border mt-2 grid grid-cols-3 divide-x lg:mt-4 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
          <Stat
            label="Total Tasks"
            shortLabel="Total"
            value={overview.total}
            tone="default"
          />
          <Stat
            label="Upcoming Tasks"
            shortLabel="Upcoming"
            value={overview.upcoming}
            tone="warning"
          />
          <Stat
            label="Expired Tasks"
            shortLabel="Expired"
            value={overview.expired}
            tone="danger"
          />
        </ul>
      </section>

      <section
        aria-labelledby={`${idPrefix}-upcoming`}
        className="border-border bg-surface hidden rounded-xl border p-5 lg:block"
      >
        <h2
          id={`${idPrefix}-upcoming`}
          className="text-foreground text-sm font-semibold tracking-tight"
        >
          Upcoming Deadlines
        </h2>
        {overview.upcomingDeadlines.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            No upcoming deadlines. New class tasks will appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {overview.upcomingDeadlines.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/assignments/${item.id}`}
                  className="hover:bg-muted focus-visible:outline-accent -mx-2 block rounded-lg px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="text-foreground block truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-xs">
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatRemainingTime(item.deadline, now)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/schedule"
          className="text-accent hover:text-accent-hover mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-md text-xs font-semibold transition-colors"
        >
          Open full schedule
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </section>
    </aside>
  );
}
