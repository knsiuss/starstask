import { CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Metric = {
  label: string;
  shortLabel: string;
  value: number;
  icon: LucideIcon;
  iconClassName: string;
  iconBackground: string;
};

/** Four compact counters. Values come straight from the student's records. */
export function AttendanceOverviewMetrics({
  totalSessions,
  present,
  late,
  absent,
}: {
  totalSessions: number;
  present: number;
  late: number;
  absent: number;
}) {
  const metrics: Metric[] = [
    {
      label: "Total Sessions",
      shortLabel: "Total",
      value: totalSessions,
      icon: CalendarDays,
      iconClassName: "text-accent",
      iconBackground: "bg-accent-soft",
    },
    {
      label: "Present",
      shortLabel: "Present",
      value: present,
      icon: CheckCircle2,
      iconClassName: "text-success",
      iconBackground: "bg-success-soft",
    },
    {
      label: "Late",
      shortLabel: "Late",
      value: late,
      icon: Clock,
      iconClassName: "text-warning",
      iconBackground: "bg-warning-soft",
    },
    {
      label: "Absent",
      shortLabel: "Absent",
      value: absent,
      icon: XCircle,
      iconClassName: "text-danger",
      iconBackground: "bg-danger-soft",
    },
  ];

  return (
    <dl className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            className="border-border bg-surface flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center sm:flex-row sm:gap-3 sm:px-4 sm:py-4 sm:text-left"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${metric.iconBackground}`}
            >
              <Icon
                aria-hidden="true"
                className={`h-3.5 w-3.5 sm:h-[18px] sm:w-[18px] ${metric.iconClassName}`}
              />
            </span>
            <div className="min-w-0">
              <dd className="text-lg leading-none font-semibold tabular-nums sm:hidden">
                {metric.value}
              </dd>
              <dt className="text-muted-foreground mt-1 truncate text-[11px] font-medium sm:mt-0 sm:text-xs">
                <span className="sm:hidden">{metric.shortLabel}</span>
                <span className="hidden sm:inline">{metric.label}</span>
              </dt>
              <dd className="mt-0.5 hidden text-2xl leading-none font-semibold tabular-nums sm:block">
                {metric.value}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
