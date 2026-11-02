import { Badge } from "@/components/ui/badge";
import {
  formatAttendancePercentage,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

const STAT_LABELS: { key: keyof AttendanceSummaryCounts; label: string }[] = [
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "excused", label: "Excused" },
  { key: "absent", label: "Absent" },
  { key: "unrecorded", label: "Not recorded" },
];

/**
 * The one summary shown to students, using the shared
 * `summarizeAttendance` policy so the Dashboard cannot disagree with it.
 */
export function AttendanceSummary({
  summary,
  pending,
}: {
  summary: AttendanceSummaryCounts;
  pending: number;
}) {
  return (
    <section
      aria-labelledby="attendance-summary"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="attendance-summary"
            className="text-muted-foreground text-sm font-medium"
          >
            Overall attendance
          </h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tracking-tight">
              {formatAttendancePercentage(summary.percentage)}
            </span>
            <span className="text-muted-foreground text-sm">
              {summary.eligible === 0
                ? "no eligible sessions yet"
                : `${summary.attended} attended of ${summary.eligible} eligible`}
            </span>
          </p>
        </div>
        {pending > 0 ? (
          <Badge variant="neutral">
            {pending} {pending === 1 ? "session pending" : "sessions pending"}
          </Badge>
        ) : null}
      </div>

      <dl className="border-border bg-border mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-5">
        {STAT_LABELS.map((stat) => (
          <div
            key={stat.key}
            className="bg-surface px-3 py-2.5"
          >
            <dt className="text-muted-foreground text-xs">{stat.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {summary[stat.key]}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        Present and late count as attended. The percentage divides those by
        present, late, absent, and unrecorded sessions. Excused absences and
        sessions that have not finished are left out.
      </p>
    </section>
  );
}
