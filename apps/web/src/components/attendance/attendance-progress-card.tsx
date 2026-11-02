import {
  formatAttendancePercentage,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

const RADIUS = 34;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BREAKDOWN = [
  { key: "present", label: "Present", dot: "bg-success" },
  { key: "late", label: "Late", dot: "bg-warning" },
  { key: "absent", label: "Absent", dot: "bg-danger" },
] as const;

/**
 * Compact sidebar summary: one ring for the percentage and four numbers for
 * the attendance policy's own counts. The ring uses the same accent as the
 * rest of the app so the card fits the existing palette.
 */
export function AttendanceProgressCard({
  summary,
  title,
  description,
  totalLabel,
}: {
  summary: AttendanceSummaryCounts;
  title: string;
  description: string;
  totalLabel: string;
}) {
  const percentage = summary.percentage;
  const progress =
    percentage === null ? 0 : Math.min(100, Math.max(0, percentage));
  const dash = (progress / 100) * CIRCUMFERENCE;

  return (
    <section
      aria-labelledby="attendance-progress"
      className="border-border bg-surface rounded-xl border p-5"
    >
      <h2
        id="attendance-progress"
        className="text-sm font-semibold tracking-tight"
      >
        {title}
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg
            viewBox="0 0 80 80"
            aria-hidden="true"
            className="h-24 w-24"
          >
            <circle
              cx="40"
              cy="40"
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-muted"
            />
            {percentage === null ? null : (
              <circle
                cx="40"
                cy="40"
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                className="stroke-accent"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tracking-tight tabular-nums">
              {formatAttendancePercentage(percentage)}
            </span>
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              attendance
            </span>
          </div>
        </div>

        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          {BREAKDOWN.map((stat) => (
            <div
              key={stat.key}
              className="bg-subtle rounded-lg px-2.5 py-1.5"
            >
              <dt className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${stat.dot}`}
                />
                {stat.label}
              </dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">
                {summary[stat.key]}
              </dd>
            </div>
          ))}
          <div className="bg-subtle rounded-lg px-2.5 py-1.5">
            <dt className="text-muted-foreground text-[11px]">{totalLabel}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums">
              {summary.eligible}
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        {summary.attended} attended of {summary.eligible} eligible ·{" "}
        {summary.excused} excused · {summary.unrecorded} not recorded
      </p>
    </section>
  );
}
