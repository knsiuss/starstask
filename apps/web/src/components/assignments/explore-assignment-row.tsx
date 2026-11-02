"use client";

import { useEffect, useState } from "react";

import { ChevronRight, ExternalLink, Paperclip } from "lucide-react";
import Link from "next/link";

import { CompletionToggle } from "@/components/assignments/completion-toggle";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { AssignmentListItem } from "@/types/database";
import {
  formatCount,
  formatDate,
  formatDeadline,
  getDeadlineState,
  pluralize,
  toJakartaDateKey,
} from "@starstask/shared";

const DUE_SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1_000;
const REFRESH_INTERVAL_MS = 60_000;

type RowStatus = {
  label: string;
  variant: BadgeProps["variant"];
};

type ExploreAssignmentRowProps = {
  assignment: AssignmentListItem;
  nowIso: string;
};

function jakartaDayNumber(value: Date): number {
  return Date.parse(`${toJakartaDateKey(value)}T00:00:00Z`) / DAY_MS;
}

/** Deadline-only status: no completion data is available in this listing. */
function rowStatus(deadline: string | null, now: Date): RowStatus {
  const state = getDeadlineState(deadline, now);

  if (!deadline || state === "none") {
    return { label: "No deadline", variant: "neutral" };
  }

  if (state === "overdue") {
    return { label: "Passed", variant: "danger" };
  }

  if (state === "due_today") {
    return { label: "Due today", variant: "warning" };
  }

  const daysLeft = jakartaDayNumber(new Date(deadline)) - jakartaDayNumber(now);

  if (daysLeft <= DUE_SOON_DAYS) {
    return {
      label: `Due in ${formatCount(daysLeft)} ${pluralize(daysLeft, "day")}`,
      variant: "warning",
    };
  }

  return { label: "Open", variant: "accent" };
}

function MetaDivider() {
  return <span aria-hidden="true">·</span>;
}

export function ExploreAssignmentRow({
  assignment,
  nowIso,
}: ExploreAssignmentRowProps) {
  const [now, setNow] = useState(() => new Date(nowIso));
  const { deadline } = assignment;

  useEffect(() => {
    if (!deadline) {
      return;
    }

    const tick = () => {
      const next = new Date();

      setNow((previous) =>
        rowStatus(deadline, previous).label === rowStatus(deadline, next).label
          ? previous
          : next,
      );
    };

    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [deadline]);

  const status = rowStatus(deadline, now);
  const courseLabel = assignment.course_code
    ? `${assignment.course_code} · ${assignment.course_name}`
    : assignment.course_name;
  const dateText = deadline
    ? formatDeadline(deadline)
    : `Published ${formatDate(assignment.created_at)}`;
  const firstTag = assignment.tags[0];

  const isAnnouncement = assignment.content_type === "class_announcement";

  return (
    <li className="flex items-center gap-2 pr-3 sm:pr-4">
      <Link
        href={`/assignments/${assignment.id}`}
        className="group hover:bg-hover focus-visible:outline-accent flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:gap-4 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-foreground group-hover:text-accent line-clamp-2 text-[15px] leading-snug font-medium">
            {assignment.title}
          </p>
          <div className="text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="max-w-full truncate">{courseLabel}</span>
            {isAnnouncement ? (
              <>
                <MetaDivider />
                <span className="text-foreground/80 whitespace-nowrap font-medium">
                  Announcement
                </span>
              </>
            ) : null}
            {assignment.source_label ? (
              <>
                <MetaDivider />
                <span className="max-w-40 truncate">
                  {assignment.source_label}
                </span>
              </>
            ) : null}
            {firstTag ? (
              <>
                <MetaDivider />
                <span className="max-w-40 truncate">#{firstTag}</span>
              </>
            ) : null}
            {assignment.attachment_count > 0 ? (
              <>
                <MetaDivider />
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Paperclip
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  {formatCount(assignment.attachment_count)}
                </span>
              </>
            ) : null}
            {assignment.drive_url ? (
              <>
                <MetaDivider />
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <ExternalLink
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Drive
                </span>
              </>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs sm:hidden">
            {dateText}
          </p>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {dateText}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <Badge
          variant={status.variant}
          className="shrink-0 whitespace-nowrap sm:hidden"
        >
          {status.label}
        </Badge>

        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground/70 h-4 w-4 shrink-0"
        />
      </Link>

      {typeof assignment.completed === "boolean" ? (
        <CompletionToggle
          assignmentId={assignment.id}
          completed={assignment.completed}
          title={assignment.title}
        />
      ) : null}
    </li>
  );
}
