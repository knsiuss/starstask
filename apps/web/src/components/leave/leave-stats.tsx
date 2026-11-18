import { CheckCircle2, FileText, Send, XCircle } from "lucide-react";
import { LEAVE_STATUS_LABELS } from "@starstask/contracts";
import type { LeaveRequestStatusCounts } from "@/lib/db/leave";

const STATS = [
  {
    status: "submitted",
    icon: Send,
    iconClassName: "bg-accent-soft text-accent",
  },
  {
    status: "approved",
    icon: CheckCircle2,
    iconClassName: "bg-success-soft text-success",
  },
  {
    status: "rejected",
    icon: XCircle,
    iconClassName: "bg-danger-soft text-danger",
  },
  {
    status: "draft",
    icon: FileText,
    iconClassName: "bg-muted text-muted-foreground",
  },
] as const;

/** Status counts over the student's own requests, shown as 4 stat cards. */
export function LeaveStats({ counts }: { counts: LeaveRequestStatusCounts }) {
  return (
    <div
      aria-label="Request statistics"
      className="grid grid-cols-4 gap-1.5 sm:gap-2.5"
    >
      {STATS.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.status}
            className="bg-surface border-border flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center sm:flex-row sm:gap-3 sm:p-3.5 sm:text-left"
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${stat.iconClassName}`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg leading-tight font-semibold tabular-nums sm:hidden">
                {counts[stat.status]}
              </span>
              <span className="text-muted-foreground block truncate text-[11px] sm:text-xs">
                {LEAVE_STATUS_LABELS[stat.status]}
              </span>
              <span className="hidden text-[22px] leading-tight font-semibold tabular-nums sm:block">
                {counts[stat.status]}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
