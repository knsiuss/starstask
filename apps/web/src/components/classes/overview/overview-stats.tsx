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
      className="border-border bg-surface rounded-xl border p-4 sm:p-5"
    >
      <h2
        id="class-overview-stats"
        className="text-foreground text-base font-semibold tracking-tight"
      >
        Class Overview
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className={`flex items-center gap-2.5 rounded-xl p-3 ${row.chip}`}
          >
            <span
              aria-hidden="true"
              className="bg-surface/70 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            >
              <row.icon className={`h-[18px] w-[18px] ${row.tone}`} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="text-muted-foreground block truncate text-[11px]">
                {row.label}
              </span>
              <span className="text-foreground block text-xl font-bold tabular-nums">
                {row.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
