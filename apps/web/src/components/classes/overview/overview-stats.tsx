import { CalendarClock, CircleCheck, ClipboardList, Info } from "lucide-react";

import type { ClassOverviewStats } from "@/lib/db/class-overview";

/**
 * Class-level counters. "Completed" is the viewer's own completion marks
 * inside this class — never a guess from passed deadlines.
 */
export function OverviewStats({ stats }: { stats: ClassOverviewStats }) {
  const rows = [
    {
      icon: ClipboardList,
      label: "Total Assignments",
      value: stats.total,
      tone: "text-accent",
      chip: "bg-accent-soft text-accent",
    },
    {
      icon: CalendarClock,
      label: "Upcoming",
      value: stats.upcoming,
      tone: "text-success",
      chip: "bg-success-soft text-success",
    },
    {
      icon: Info,
      label: "Due Today",
      value: stats.dueToday,
      tone: "text-warning",
      chip: "bg-warning-soft text-warning",
    },
    {
      icon: CircleCheck,
      label: "Completed",
      value: stats.completed,
      tone: "text-accent-hover",
      chip: "bg-accent-soft text-accent",
    },
  ];

  return (
    <section
      aria-labelledby="class-overview-stats"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <h2
        id="class-overview-stats"
        className="text-foreground text-base font-semibold tracking-tight"
      >
        Class Overview
      </h2>
      <ul className="mt-4 space-y-4">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-muted-foreground inline-flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${row.chip}`}
              >
                <row.icon className="h-4 w-4" />
              </span>
              {row.label}
            </span>
            <span className={`text-lg font-semibold tabular-nums ${row.tone}`}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
