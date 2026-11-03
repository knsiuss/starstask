import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CompletionToggle } from "@/components/assignments/completion-toggle";
import { courseColorFor } from "@/lib/schedule/course-colors";
import type { TimelineItem } from "@/lib/schedule/timeline";
import { cn } from "@/lib/utils/cn";
import type { CalendarDayCell } from "@starstask/shared";

type TimelineListProps = {
  days: CalendarDayCell[];
  items: TimelineItem[];
  todayKey: string;
};

/**
 * Chronological list of everything in the visible window, grouped by day.
 * Assignments are listed on their deadline day (that is the actionable part).
 */
export function TimelineList({ days, items, todayKey }: TimelineListProps) {
  const groups = groupByDay(items, days[0]?.dateKey, days.at(-1)?.dateKey);

  if (groups.length === 0) {
    return (
      <div className="border-border bg-subtle text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
        Nothing in this window for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section
          key={group.dateKey}
          aria-label={group.dateKey}
        >
          <div className="flex items-center justify-between gap-3">
            <h3
              className={cn(
                "text-sm font-semibold tracking-tight",
                group.dateKey === todayKey && "text-accent",
              )}
            >
              {formatGroupLabel(group.dateKey)}
            </h3>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
              {group.items.length}
            </span>
          </div>
          <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
            {group.items.map((item) => (
              <li key={item.id}>
                <TimelineListRow
                  item={item}
                  todayKey={todayKey}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TimelineListRow({
  item,
  todayKey,
}: {
  item: TimelineItem;
  todayKey: string;
}) {
  const isAssignment = item.kind === "assignment";
  const palette = isAssignment
    ? courseColorFor(item.courseKey ?? "unassigned")
    : null;
  const isCompleted = item.isCompleted ?? false;
  const isOverdue = item.isOverdue ?? item.endKey < todayKey;

  const rowTint = isCompleted
    ? {
        dot: palette?.doneBorder ?? "#15803d",
        chipBg: "oklch(0.95 0.03 155)",
        chipText: "oklch(0.33 0.06 160)",
        chipLabel: "Completed",
      }
    : isOverdue && isAssignment
      ? {
          dot: "#a94a4a",
          chipBg: "#fbeded",
          chipText: "#a94a4a",
          chipLabel: "Past due",
        }
      : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <span
        aria-hidden="true"
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ background: rowTint?.dot ?? palette?.dot ?? "#9aa0aa" }}
      />

      <div className="min-w-0 flex-1">
        {item.href ? (
          <Link
            href={item.href}
            className="hover:text-accent block truncate text-sm font-medium"
          >
            {item.title}
          </Link>
        ) : (
          <p className="text-foreground truncate text-sm font-medium">
            {item.title}
          </p>
        )}
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {subtitleFor(item)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {rowTint ? (
          <span
            className="hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex"
            style={{ background: rowTint.chipBg, color: rowTint.chipText }}
          >
            {rowTint.chipLabel}
          </span>
        ) : null}
        {isAssignment && item.assignmentId ? (
          <CompletionToggle
            assignmentId={item.assignmentId}
            completed={isCompleted}
            title={item.title}
          />
        ) : null}
        {item.href ? (
          <Link
            href={item.href}
            aria-label={`Open ${item.title}`}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-accent rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function subtitleFor(item: TimelineItem): string {
  if (item.kind === "assignment") {
    const course = item.courseCode ?? item.courseName ?? "Assignment";
    const span =
      item.startKey !== item.endKey
        ? `${item.startKey} → ${item.endKey}`
        : item.endKey;

    return `${course} · published ${span}`;
  }

  return KIND_SUBTITLES[item.kind] ?? "Calendar";
}

const KIND_SUBTITLES: Record<string, string> = {
  class_schedule: "Class schedule",
  exam: "Exam",
  academic_event: "Academic event",
  personal: "Personal event",
  absence: "Absence notification",
};

type DayGroup = { dateKey: string; items: TimelineItem[] };

function groupByDay(
  items: readonly TimelineItem[],
  fromKey?: string,
  toKey?: string,
): DayGroup[] {
  const map = new Map<string, TimelineItem[]>();

  for (const item of items) {
    const key = item.kind === "assignment" ? item.endKey : item.startKey;

    if (!key) {
      continue;
    }

    if (fromKey && key < fromKey) {
      continue;
    }

    if (toKey && key > toKey) {
      continue;
    }

    const bucket = map.get(key);

    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, grouped]) => ({
      dateKey,
      items: grouped
        .map((item) => item)
        .sort((left, right) => {
          const byKind = kindRank(left.kind) - kindRank(right.kind);

          return byKind !== 0 ? byKind : left.title.localeCompare(right.title);
        }),
    }));
}

function kindRank(kind: TimelineItem["kind"]): number {
  return kind === "assignment" ? 0 : 1;
}

function formatGroupLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);

  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}
