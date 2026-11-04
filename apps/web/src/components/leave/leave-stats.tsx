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
      className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"
    >
      {STATS.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.status}
            className="bg-surface border-border flex items-center gap-3 rounded-xl border p-3 shadow-sm"
          >
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="text-muted-foreground block truncate text-xs">
                {LEAVE_STATUS_LABELS[stat.status]}
              </span>
              <span className="block text-[22px] leading-tight font-bold tabular-nums">
                {counts[stat.status]}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
