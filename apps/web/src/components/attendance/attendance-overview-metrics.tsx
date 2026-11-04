import { CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Metric = {
  label: string;
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
      value: totalSessions,
      icon: CalendarDays,
      iconClassName: "text-accent",
      iconBackground: "bg-accent-soft",
    },
    {
      label: "Present",
      value: present,
      icon: CheckCircle2,
      iconClassName: "text-success",
      iconBackground: "bg-success-soft",
    },
    {
      label: "Late",
      value: late,
      icon: Clock,
      iconClassName: "text-warning",
      iconBackground: "bg-warning-soft",
    },
    {
      label: "Absent",
      value: absent,
      icon: XCircle,
      iconClassName: "text-danger",
      iconBackground: "bg-danger-soft",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            className="border-border bg-surface flex items-center gap-2.5 rounded-xl border p-3 sm:gap-3 sm:px-4 sm:py-4"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${metric.iconBackground}`}
            >
              <Icon
                aria-hidden="true"
                className={`h-[18px] w-[18px] ${metric.iconClassName}`}
              />
            </span>
            <div className="min-w-0">
              <dt className="text-muted-foreground truncate text-xs font-medium">
                {metric.label}
              </dt>
              <dd className="mt-0.5 text-[22px] leading-none font-semibold tabular-nums sm:text-2xl">
                {metric.value}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
