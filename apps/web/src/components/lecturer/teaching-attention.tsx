import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import {
  type ActionCenterRow,
  type ActionCounts,
} from "@/lib/classes/action-center";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@starstask/shared";

type AttentionMetric = {
  key: keyof ActionCounts;
  label: string;
  href: string;
};

const ATTENTION_METRICS: readonly AttentionMetric[] = [
  {
    key: "pendingSubmissions",
    label: "Submissions to review",
    href: "/actions?tab=assignments",
  },
  {
    key: "pendingLeave",
    label: "Absence requests",
    href: "/actions?tab=absences",
  },
  {
    key: "todaysSessions",
    label: "Sessions today",
    href: "/actions?tab=attendance",
  },
  {
    key: "openReports",
    label: "Reader reports",
    href: "/actions",
  },
];

/**
 * Calm metric strip for the four counters a lecturer checks first.
 * Zero values stay muted; only non-zero counts carry accent emphasis.
 */
export function TeachingAttention({ totals }: { totals: ActionCounts }) {
  const waitingTotal =
    totals.pendingSubmissions + totals.pendingLeave + totals.openReports;

  return (
    <section
      aria-labelledby="teaching-attention"
      className="mt-7"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="teaching-attention"
          className="text-base font-semibold tracking-tight"
        >
          Needs your attention
        </h2>
        <p className="text-muted-foreground text-xs">
          {waitingTotal === 0
            ? "All clear"
            : `${waitingTotal} ${pluralize(waitingTotal, "item")} open`}
        </p>
      </div>

      <ul className="border-border bg-surface divide-border mt-3 grid grid-cols-4 divide-x overflow-hidden rounded-xl border">
        {ATTENTION_METRICS.map((metric) => {
          const value = totals[metric.key];
          const hasItems = value > 0;

          return (
            <li
              key={metric.key}
              className="min-w-0"
            >
              <Link
                href={metric.href}
                className="hover:bg-muted/40 focus-visible:outline-accent group flex h-full flex-col items-center justify-center gap-1 px-1.5 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:flex-row sm:justify-between sm:gap-3 sm:px-4 sm:py-3.5 sm:text-left"
              >
                <span className="min-w-0 max-w-full">
                  <span
                    className={cn(
                      "block text-lg leading-none font-semibold tracking-tight tabular-nums sm:hidden",
                      hasItems ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {value}
                  </span>
                  <span className="text-muted-foreground mt-1 block truncate text-[11px] font-medium sm:mt-0 sm:text-xs">
                    {metric.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 hidden text-2xl leading-none font-semibold tracking-tight tabular-nums sm:block",
                      hasItems ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {value}
                  </span>
                </span>

                <ArrowRight
                  aria-hidden="true"
                  className={cn(
                    "hidden h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block",
                    hasItems
                      ? "text-accent"
                      : "text-muted-foreground/50 group-hover:text-muted-foreground",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Classes with a scheduled meeting today, linking straight to sessions or attendance. */
export function TeachingToday({ rows }: { rows: ActionCenterRow[] }) {
  const sessions = rows.filter((row) => row.todaysSessions > 0);

  return (
    <section aria-labelledby="teaching-today">
      <h2
        id="teaching-today"
        className="text-base font-semibold tracking-tight"
      >
        Today&rsquo;s teaching
      </h2>

      {sessions.length === 0 ? (
        <div className="border-border bg-surface mt-3 flex items-center gap-3 rounded-xl border px-4 py-4">
          <CalendarClock
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4 shrink-0"
          />
          <p className="text-muted-foreground text-sm">
            No sessions scheduled today.
          </p>
        </div>
      ) : (
        <ul className="border-border bg-surface divide-border mt-3 divide-y overflow-hidden rounded-xl border">
          {sessions.map((row) => (
            <li
              key={row.classId}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0">
                <Link
                  href={`/classes/${row.classSlug}/sessions`}
                  className="hover:text-accent focus-visible:outline-accent block truncate rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {row.className}
                </Link>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {row.todaysSessions}{" "}
                  {pluralize(row.todaysSessions, "session")} today
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/classes/${row.classSlug}/attendance`}
                  className="border-border bg-background hover:bg-muted rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  Attendance
                </Link>
                <Link
                  href={`/classes/${row.classSlug}/sessions`}
                  aria-label={`Open ${row.className} sessions`}
                  className="text-muted-foreground hover:text-accent p-1 transition-colors"
                >
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
