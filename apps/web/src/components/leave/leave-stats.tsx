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
    iconClassName: "bg-emerald-500/10 text-emerald-600",
  },
  {
    status: "rejected",
    icon: XCircle,
    iconClassName: "bg-red-500/10 text-red-500",
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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {STATS.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.status}
            className="bg-surface border-border flex items-center gap-4 rounded-2xl border px-5 py-4 shadow-sm"
          >
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconClassName}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="text-muted-foreground block text-xs">
                {LEAVE_STATUS_LABELS[stat.status]}
              </span>
              <span className="block text-2xl leading-tight font-bold">
                {counts[stat.status]}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
