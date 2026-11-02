import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import {
  formatAttendancePercentage,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

type DashboardAttendanceSectionProps = {
  summary: AttendanceSummaryCounts;
  pendingAbsences: number;
};

/**
 * A compact rail summary that uses the same policy as the Attendance page:
 * late counts as attended, excused is not present, and pending or unrecorded
 * sessions stay in the denominator only when they are already finished.
 */
export function DashboardAttendanceSection({
  summary,
  pendingAbsences,
}: DashboardAttendanceSectionProps) {
  const counts = [
    { label: "Present", value: summary.present },
    { label: "Late", value: summary.late },
    { label: "Excused", value: summary.excused },
    { label: "Absent", value: summary.absent },
    { label: "Not recorded", value: summary.unrecorded },
  ];

  return (
    <section
      aria-labelledby="dashboard-attendance"
      className="border-border bg-surface rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]"
    >
      <div className="px-4 pt-4">
        <SectionHeader
          id="dashboard-attendance"
          title="Attendance"
          density="rail"
          action={{ href: "/attendance", label: "View" }}
        />
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-foreground text-2xl leading-none font-semibold tracking-tight">
            {formatAttendancePercentage(summary.percentage)}
          </span>
          <span className="text-muted-foreground text-xs">
            {summary.attended} of {summary.eligible} counted sessions attended
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {counts.map((count) => (
            <div
              key={count.label}
              className="flex items-baseline justify-between gap-2"
            >
              <dt className="text-muted-foreground truncate">{count.label}</dt>
              <dd className="font-medium tabular-nums">{count.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
          Late counts as attended. Excused and pending sessions do not count as
          present.
        </p>

        <Link
          href="/leave-requests?status=submitted"
          className="border-border hover:bg-hover focus-visible:outline-accent mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <span>
            {pendingAbsences === 0
              ? "No absences awaiting review"
              : `${pendingAbsences} ${pendingAbsences === 1 ? "absence" : "absences"} awaiting review`}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-muted-foreground h-3.5 w-3.5 shrink-0"
          />
        </Link>
      </div>
    </section>
  );
}
