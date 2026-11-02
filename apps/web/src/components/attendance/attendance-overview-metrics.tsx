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
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            className="border-border bg-surface flex items-center gap-3 rounded-xl border px-4 py-4"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${metric.iconBackground}`}
            >
              <Icon
                aria-hidden="true"
                className={`h-5 w-5 ${metric.iconClassName}`}
              />
            </span>
            <div className="min-w-0">
              <dt className="text-muted-foreground truncate text-xs font-medium">
                {metric.label}
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {metric.value}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
