import type { AttendanceGroupSummary } from "@/lib/db/attendance";
import {
  formatAttendancePercentage,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

function percentageWidth(counts: AttendanceSummaryCounts): string {
  return counts.percentage === null
    ? "0%"
    : `${Math.min(100, counts.percentage)}%`;
}

export function AttendanceBreakdown({
  title,
  description,
  groups,
}: {
  title: string;
  description: string;
  groups: AttendanceGroupSummary[];
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section aria-label={title}>
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>

      <ul className="mt-3 grid gap-2">
        {groups.map((group) => (
          <li
            key={group.key}
            className="border-border bg-surface rounded-lg border px-3.5 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{group.label}</p>
                {group.secondaryLabel ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {group.secondaryLabel}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatAttendancePercentage(group.counts.percentage)}
              </p>
            </div>

            <div
              role="presentation"
              className="bg-muted mt-2 h-1 overflow-hidden rounded-full"
            >
              <div
                className="bg-accent h-full rounded-full"
                style={{ width: percentageWidth(group.counts) }}
              />
            </div>

            <p className="text-muted-foreground mt-1.5 text-[11px] tabular-nums">
              {group.counts.attended} attended · {group.counts.absent} absent ·{" "}
              {group.counts.unrecorded} not recorded · {group.counts.excused}{" "}
              excused
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
