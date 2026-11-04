import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { formatRemainingTime } from "@/lib/assignments/workspace";
import type { WorkspaceOverview } from "@/lib/db/assignment-workspace";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";

  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={`text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}
      >
        {value}
      </span>
    </li>
  );
}

/**
 * Right sidebar: overview numbers plus the nearest upcoming deadlines, all
 * computed from the same visible published set as the schedule list.
 */
export function OverviewSidebar({ overview }: { overview: WorkspaceOverview }) {
  const now = new Date();

  return (
    <aside className="space-y-5">
      <section
        aria-labelledby="workspace-overview"
        className="border-border bg-surface rounded-xl border p-5"
      >
        <h2
          id="workspace-overview"
          className="text-foreground text-sm font-semibold tracking-tight"
        >
          Overview
        </h2>
        <ul className="mt-4 space-y-3">
          <Stat
            label="Total Tasks"
            value={overview.total}
            tone="default"
          />
          <Stat
            label="Upcoming Tasks"
            value={overview.upcoming}
            tone="warning"
          />
          <Stat
            label="Expired Tasks"
            value={overview.expired}
            tone="danger"
          />
        </ul>
      </section>

      <section
        aria-labelledby="workspace-upcoming"
        className="border-border bg-surface rounded-xl border p-5"
      >
        <h2
          id="workspace-upcoming"
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
          className="text-accent hover:text-accent-hover mt-3 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold transition-colors"
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
