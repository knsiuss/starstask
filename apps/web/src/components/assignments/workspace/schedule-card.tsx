import { ArrowUpRight, Paperclip } from "lucide-react";
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
 * One compact row of the Task Schedule: course, status, title, class name,
 * deadline, and an attachment indicator when files exist.
 */
export function ScheduleCard({ item }: { item: WorkspaceScheduleItem }) {
  const courseLabel = item.course_code
    ? `${item.course_code} · ${item.course_name}`
    : item.course_name;

  return (
    <li className="border-border bg-surface hover:border-accent/40 focus-within:border-accent/50 group rounded-xl border p-3.5 transition-colors sm:p-4">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs sm:gap-2">
            <Badge
              variant="neutral"
              className="max-w-full sm:max-w-xs"
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
                className="text-muted-foreground inline-flex items-center gap-1 tabular-nums"
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
            className="text-foreground group-hover:text-accent focus-visible:outline-accent mt-2 block rounded-sm text-[15px] leading-snug font-semibold tracking-tight break-words line-clamp-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {item.title}
          </Link>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <DeadlineBadge deadline={item.deadline} />
            <span className="text-muted-foreground truncate text-xs">
              {item.class_name ?? "Class course"}
            </span>
          </div>
        </div>

        <Link
          href={`/assignments/${item.id}`}
          aria-label={`View ${item.title}`}
          className="text-muted-foreground hover:bg-muted hover:text-accent focus-visible:outline-accent -mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:mr-0 sm:h-9 sm:w-9"
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
