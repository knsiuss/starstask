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
      shortLabel: "Tasks",
      value: stats.total,
      tone: "text-accent",
      chip: "bg-accent-soft text-accent",
    },
    {
      icon: CalendarClock,
      label: "Upcoming",
      shortLabel: "Upcoming",
      value: stats.upcoming,
      tone: "text-success",
      chip: "bg-success-soft text-success",
    },
    {
      icon: Info,
      label: "Due Today",
      shortLabel: "Today",
      value: stats.dueToday,
      tone: "text-warning",
      chip: "bg-warning-soft text-warning",
    },
    {
      icon: CircleCheck,
      label: "Completed",
      shortLabel: "Done",
      value: stats.completed,
      tone: "text-accent-hover",
      chip: "bg-accent-soft text-accent",
    },
  ];

  return (
    <section
      aria-labelledby="class-overview-stats"
      className="border-border bg-surface rounded-xl border p-3.5 sm:p-5"
    >
      <h2
        id="class-overview-stats"
        className="text-foreground text-base font-semibold tracking-tight"
      >
        Class Overview
      </h2>
      <ul className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2.5 xl:grid-cols-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1.5 py-2.5 text-center sm:flex-row sm:gap-2.5 sm:p-3 sm:text-left ${row.chip}`}
          >
            <span
              aria-hidden="true"
              className="bg-surface/70 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9"
            >
              <row.icon
                className={`h-3.5 w-3.5 sm:h-[18px] sm:w-[18px] ${row.tone}`}
              />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="text-foreground block text-lg font-bold tabular-nums sm:hidden">
                {row.value}
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                <span className="sm:hidden">{row.shortLabel}</span>
                <span className="hidden sm:inline">{row.label}</span>
              </span>
              <span className="text-foreground hidden text-xl font-bold tabular-nums sm:block">
                {row.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
