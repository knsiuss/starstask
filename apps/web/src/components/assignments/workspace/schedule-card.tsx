import { Paperclip } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceScheduleItem } from "@/lib/db/assignment-workspace";

const STATUS_LABELS: Record<string, string> = {
  published: "Published",
  pending_review: "Pending",
  rejected: "Rejected",
  draft: "Draft",
};

const STATUS_VARIANTS: Record<
  string,
  "accent" | "warning" | "danger" | "neutral"
> = {
  published: "accent",
  pending_review: "warning",
  rejected: "danger",
  draft: "neutral",
};

/**
 * One compact row of the Task Schedule: title, course, class code, deadline,
 * publication status, and an attachment indicator when files exist.
 */
export function ScheduleCard({ item }: { item: WorkspaceScheduleItem }) {
  const courseLabel = item.course_code
    ? `${item.course_code} · ${item.course_name}`
    : item.course_name;

  return (
    <li className="border-border bg-surface hover:border-accent/30 focus-within:border-accent/40 rounded-xl border px-3.5 py-3.5 transition-colors sm:px-4">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs sm:gap-2">
            <Badge
              variant="neutral"
              className="max-w-[62%] sm:max-w-none"
            >
              <span className="truncate">{courseLabel}</span>
            </Badge>
            {item.class_code ? (
              <span className="text-muted-foreground tabular-nums">
                {item.class_code}
              </span>
            ) : null}
            <Badge variant={STATUS_VARIANTS[item.status] ?? "neutral"}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Badge>
            {item.attachment_count > 0 ? (
              <span
                className="text-muted-foreground inline-flex items-center gap-1"
                title={`${item.attachment_count} attachment(s)`}
              >
                <Paperclip
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                {item.attachment_count}
              </span>
            ) : null}
          </div>
          <Link
            href={`/assignments/${item.id}`}
            className="text-foreground hover:text-accent mt-1.5 block text-[15px] font-semibold tracking-tight break-words focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 line-clamp-2"
          >
            {item.title}
          </Link>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {item.class_name ?? "Class course"}
          </p>
          <div className="mt-2 min-w-0">
            <DeadlineBadge deadline={item.deadline} />
          </div>
        </div>
        <Link
          href={`/assignments/${item.id}`}
          aria-label={`View ${item.title}`}
          className="text-muted-foreground hover:text-accent mt-0.5 shrink-0 rounded-md p-1.5 focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowUpRight
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Link>
      </div>
    </li>
  );
}
