"use client";

import { Check, ChevronRight, Flag } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { EventFormDialog } from "@/components/schedule/event-form-dialog";
import { toFormEvent } from "@/components/schedule/event-form-model";
import { courseColorFor } from "@/lib/schedule/course-colors";
import {
  MAX_VISIBLE_LANES,
  diffDays,
  layoutWeekRow,
  shiftKey,
  splitIntoWeeks,
  type PositionedItem,
  type TimelineItem,
  type TimelineItemKind,
} from "@/lib/schedule/timeline";
import type {
  CalendarClassOption,
  CalendarSubjectOption,
} from "@/lib/db/calendar";
import { cn } from "@/lib/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  APP_TIME_ZONE,
  APP_TIME_ZONE_OFFSET,
  formatCalendarShortDay,
  toJakartaDateKey,
  type CalendarDayCell,
} from "@starstask/shared";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LANE_HEIGHT = 34;
const LANE_GAP = 6;
const SKY = "#0ea5e9";

type TimelineBoardProps = {
  view: "week" | "month";
  days: CalendarDayCell[];
  items: TimelineItem[];
  todayKey: string;
  classes: CalendarClassOption[];
  subjects: CalendarSubjectOption[];
  /**
   * Mobile month view: date cells show indicators instead of full
   * spanning bars, and each cell links to the list view for that date.
   */
  compact?: boolean;
};

/**
 * The assignment timeline: bars span publication -> deadline, non-assignment
 * calendar entries get shorter bars in the same lanes. Layout is recomputed
 * client-side as the Jakarta date ticks over midnight, so the today line and
 * the overdue styling follow the clock without a reload.
 */
export function TimelineBoard({
  view,
  days,
  items,
  todayKey: serverTodayKey,
  classes,
  subjects,
  compact = false,
}: TimelineBoardProps) {
  const todayKey = useJakartaToday(serverTodayKey);
  const weeks = splitIntoWeeks(days);
  const markedKeys = React.useMemo(() => buildMarkedDayKeys(items), [items]);
  const [moreContext, setMoreContext] = React.useState<{
    weekStartKey: string;
    hidden: TimelineItem[];
  } | null>(null);

  return (
    <div className="border-border bg-surface overflow-hidden rounded-2xl border shadow-sm">
      <WeekdayHeader />

      {weeks.map((week, index) => {
        const rowStartKey = week[0]?.dateKey ?? serverTodayKey;
        const rowEndKey = week[week.length - 1]?.dateKey ?? rowStartKey;

        return (
          <WeekRow
            key={rowStartKey}
            week={week}
            items={items}
            rowStartKey={rowStartKey}
            rowEndKey={rowEndKey}
            todayKey={todayKey}
            isWeekView={view === "week"}
            showTopBorder={index > 0}
            compact={compact}
            markedKeys={markedKeys}
            onMore={(hidden) =>
              setMoreContext({ weekStartKey: rowStartKey, hidden })
            }
            classes={classes}
            subjects={subjects}
          />
        );
      })}

      {moreContext ? (
        <MoreItemsDialog
          weekStartKey={moreContext.weekStartKey}
          items={moreContext.hidden}
          onClose={() => setMoreContext(null)}
        />
      ) : null}
    </div>
  );
}

function useJakartaToday(initialKey: string): string {
  const [todayKey, setTodayKey] = React.useState(initialKey);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setTodayKey((current) => {
        const next = toJakartaDateKey(new Date());

        return next === current ? current : next;
      });
    }, 30_000);

    return () => window.clearInterval(id);
  }, []);

  return todayKey;
}

/** Days touched by at least one item, used by the compact dot indicators. */
function buildMarkedDayKeys(items: readonly TimelineItem[]): Set<string> {
  const marked = new Set<string>();

  for (const item of items) {
    const span = diffDays(item.startKey, item.endKey);

    for (let offset = 0; offset <= span; offset += 1) {
      marked.add(shiftKey(item.startKey, offset));
    }
  }

  return marked;
}

function WeekdayHeader() {
  return (
    <div className="border-border bg-subtle grid grid-cols-7 border-b">
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          className="text-muted-foreground py-2 text-center text-[11px] font-medium tracking-[0.08em] uppercase"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

type WeekRowProps = {
  week: CalendarDayCell[];
  items: TimelineItem[];
  rowStartKey: string;
  rowEndKey: string;
  todayKey: string;
  isWeekView: boolean;
  showTopBorder: boolean;
  compact: boolean;
  markedKeys: ReadonlySet<string>;
  onMore: (hidden: TimelineItem[]) => void;
  classes: CalendarClassOption[];
  subjects: CalendarSubjectOption[];
};

function WeekRow({
  week,
  items,
  rowStartKey,
  rowEndKey,
  todayKey,
  isWeekView,
  showTopBorder,
  compact,
  markedKeys,
  onMore,
  classes,
  subjects,
}: WeekRowProps) {
  const layout = layoutWeekRow(items, rowStartKey, MAX_VISIBLE_LANES);
  const laneBudget = Math.min(layout.laneCount, MAX_VISIBLE_LANES);
  const needsMore = layout.hidden.length > 0;
  const laneSlots = needsMore
    ? MAX_VISIBLE_LANES + 1
    : Math.max(laneBudget, isWeekView ? 3 : 1);
  const height =
    laneSlots * LANE_HEIGHT + Math.max(laneSlots - 1, 0) * LANE_GAP + 12;
  const emptyStateMin = isWeekView ? 320 : 64;

  return (
    <div className={cn(showTopBorder && "border-border border-t")}>
      <div className="grid grid-cols-7">
        {week.map((day) => (
          <DayCell
            key={day.dateKey}
            day={day}
            todayKey={todayKey}
            compact={compact}
            marked={markedKeys.has(day.dateKey)}
          />
        ))}
      </div>

      {compact ? null : (
        <div
          className="relative"
          style={{ height: `${Math.max(height, emptyStateMin)}px` }}
        >
          {layout.items.length === 0 ? (
            <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs">
              —
            </div>
          ) : null}

          {layout.items.map((item) => (
            <Bar
              key={item.id}
              item={item}
              rowStartKey={rowStartKey}
              rowEndKey={rowEndKey}
              todayKey={todayKey}
              classes={classes}
              subjects={subjects}
            />
          ))}

          {needsMore ? (
            <button
              type="button"
              onClick={() => onMore(layout.hidden)}
              className="text-accent hover:bg-accent-soft focus-visible:outline-accent absolute right-2 z-10 rounded-full px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                top: 6 + MAX_VISIBLE_LANES * (LANE_HEIGHT + LANE_GAP),
              }}
            >
              +{layout.hidden.length} more
            </button>
          ) : null}

          <TodayLine
            week={week}
            todayKey={todayKey}
          />
        </div>
      )}
    </div>
  );
}

function DayCell({
  day,
  todayKey,
  compact,
  marked,
}: {
  day: CalendarDayCell;
  todayKey: string;
  compact: boolean;
  marked: boolean;
}) {
  const isToday = day.dateKey === todayKey;

  const inner = (
    <>
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          isToday ? "text-white" : "text-muted-foreground",
        )}
        style={isToday ? { background: SKY } : undefined}
      >
        {day.dayOfMonth}
      </span>
      {compact && marked ? (
        <span
          aria-hidden="true"
          className="mt-1 block h-1 w-1 rounded-full mx-auto"
          style={{ background: isToday ? SKY : "#45639e" }}
        />
      ) : null}
    </>
  );

  const className = cn(
    "border-border/60 border-l py-2 pr-2 text-center sm:text-right first:border-l-0",
    !day.inMonth && "opacity-55",
    isToday && "bg-[#eef6fd]",
    compact && "block min-h-14",
  );

  if (compact) {
    return (
      <Link
        href={`/schedule?view=list&date=${day.dateKey}`}
        aria-label={`${day.dateKey}${isToday ? ", today" : ""}${marked ? ", has events" : ""}`}
        className={className}
      >
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function TodayLine({
  week,
  todayKey,
}: {
  week: CalendarDayCell[];
  todayKey: string;
}) {
  const index = week.findIndex((day) => day.dateKey === todayKey);

  if (index === -1) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-20"
      style={{ left: `calc(${((index + 0.5) / 7) * 100}% - 1px)` }}
    >
      <div
        className="h-full w-[2px]"
        style={{
          background: SKY,
          boxShadow: "0 0 0 1px rgba(14,165,233,0.15)",
        }}
      />
    </div>
  );
}

type BarProps = {
  item: PositionedItem;
  rowStartKey: string;
  rowEndKey: string;
  todayKey: string;
  classes: CalendarClassOption[];
  subjects: CalendarSubjectOption[];
};

function Bar({
  item,
  rowStartKey,
  rowEndKey,
  todayKey,
  classes,
  subjects,
}: BarProps) {
  const styling = barStyling(item, todayKey);
  const clippedLeft = item.startKey < rowStartKey;
  const clippedRight = item.endKey > rowEndKey;
  const widthPct = (item.span / 7) * 100;
  const leftPct = (item.colStart / 7) * 100;
  const inPast =
    item.kind === "assignment" &&
    item.startKey < todayKey &&
    item.endKey >= todayKey;
  const pastPct = inPast ? pastPortion(item, rowStartKey, todayKey) : 0;

  const body = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {item.isCompleted ? (
          <Check
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={3}
          />
        ) : item.kind === "assignment" ? (
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: styling.dot }}
          />
        ) : null}
        <span className="truncate">{item.title}</span>
      </span>
      {item.kind === "assignment" && item.endKey ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="tabular-nums opacity-90">
            {formatDeadlineChip(item.endKey)}
          </span>
          {item.isOverdue && !item.isCompleted ? (
            <Flag
              aria-hidden="true"
              className="h-3 w-3"
              fill="currentColor"
            />
          ) : null}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "absolute z-10 flex h-[34px] items-center gap-1.5 border px-2 text-[11px] leading-none font-medium shadow-sm transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2",
    clippedLeft ? "rounded-l-none border-l-0" : "rounded-l-md",
    clippedRight ? "rounded-r-none border-r-0" : "rounded-r-md",
    "hover:z-20 hover:shadow-md",
  );

  const style: React.CSSProperties = {
    left: `calc(${leftPct}% + 3px)`,
    width: `calc(${widthPct}% - 6px)`,
    top: 6 + item.lane * (LANE_HEIGHT + LANE_GAP),
    background: styling.background,
    borderColor: styling.border,
    color: styling.text,
  };

  const inner = (
    <>
      {pastPct > 0 ? (
        <span
          aria-hidden="true"
          className="timeline-bar-past absolute inset-y-0 left-0 rounded-l-md"
          style={{ width: `${pastPct}%` }}
        />
      ) : null}
      <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
        {body}
      </span>
    </>
  );

  const nativeEvent = item.nativeEvent;
  const formEvent = nativeEvent ? toFormEvent(nativeEvent) : null;

  if (formEvent) {
    return (
      <EventFormDialog
        scope={formEvent.eventType === "personal" ? "personal" : "official"}
        event={formEvent}
        defaultDateKey={item.startKey}
        classes={classes}
        subjects={subjects}
        triggerLabel={inner}
        triggerVariant="ghost"
        triggerSize="sm"
        triggerClassName={cn(className, "justify-start font-normal")}
        triggerStyle={style}
        ariaLabel={`Edit ${item.title}`}
      />
    );
  }

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        style={style}
        aria-label={barAriaLabel(item)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={className}
      style={style}
      title={item.title}
    >
      {inner}
    </div>
  );
}

function pastPortion(
  item: TimelineItem,
  rowStartKey: string,
  todayKey: string,
): number {
  const effStart = item.startKey < rowStartKey ? rowStartKey : item.startKey;
  const totalDays = diffDays(effStart, item.endKey) + 1;

  if (totalDays <= 0) {
    return 0;
  }

  const daysBeforeToday = diffDays(effStart, todayKey);

  return Math.max(0, Math.min(100, (daysBeforeToday / totalDays) * 100));
}

function barAriaLabel(item: PositionedItem): string {
  const parts = [item.title];

  if (item.kind === "assignment") {
    parts.push(`deadline ${item.endKey}`);
  }

  return parts.join(", ");
}

function formatDeadlineChip(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00${APP_TIME_ZONE_OFFSET}`);

  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIME_ZONE,
        day: "2-digit",
        month: "short",
      }).format(date);
}

const KIND_COLORS: Record<
  TimelineItemKind,
  { background: string; border: string; text: string; dot: string }
> = {
  assignment: {
    background: "oklch(0.95 0.025 230)",
    border: "oklch(0.82 0.05 230)",
    text: "oklch(0.38 0.06 240)",
    dot: "oklch(0.62 0.13 240)",
  },
  class_schedule: {
    background: "oklch(0.95 0.025 230)",
    border: "oklch(0.82 0.05 230)",
    text: "oklch(0.38 0.06 240)",
    dot: "oklch(0.62 0.13 240)",
  },
  exam: {
    background: "oklch(0.96 0.04 85)",
    border: "oklch(0.84 0.07 85)",
    text: "oklch(0.4 0.07 75)",
    dot: "oklch(0.7 0.14 75)",
  },
  academic_event: {
    background: "oklch(0.95 0.035 160)",
    border: "oklch(0.81 0.06 160)",
    text: "oklch(0.32 0.055 160)",
    dot: "oklch(0.6 0.12 160)",
  },
  personal: {
    background: "oklch(0.96 0.005 260)",
    border: "oklch(0.85 0.01 260)",
    text: "oklch(0.38 0.01 260)",
    dot: "oklch(0.6 0.01 260)",
  },
  absence: {
    background: "oklch(0.96 0.035 45)",
    border: "oklch(0.83 0.055 45)",
    text: "oklch(0.4 0.06 45)",
    dot: "oklch(0.68 0.13 45)",
  },
};

function barStyling(
  item: TimelineItem,
  todayKey: string,
): { background: string; border: string; text: string; dot: string } {
  if (item.kind !== "assignment") {
    return KIND_COLORS[item.kind];
  }

  const palette = courseColorFor(item.courseKey ?? "unassigned");

  if (item.isCompleted) {
    return {
      background: palette.doneBackground,
      border: palette.doneBorder,
      text: palette.doneText,
      dot: palette.doneBorder,
    };
  }

  if (item.endKey < todayKey) {
    return {
      background: "#ececef",
      border: "#d9d9dc",
      text: "#4a4a4f",
      dot: "#c40d0d",
    };
  }

  return {
    background: palette.background,
    border: palette.border,
    text: palette.text,
    dot: palette.dot,
  };
}

function MoreItemsDialog({
  weekStartKey,
  items,
  onClose,
}: {
  weekStartKey: string;
  items: TimelineItem[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>More this week</DialogTitle>
        <DialogDescription>
          Everything that did not fit the visible timeline for the week of{" "}
          {formatCalendarShortDay(weekStartKey)}.
        </DialogDescription>
        <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href ?? "#"}
                className="hover:bg-subtle flex items-center gap-2 rounded-md px-2 py-2 text-sm"
                onClick={
                  item.href ? undefined : (event) => event.preventDefault()
                }
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: barStyling(item, weekStartKey).dot }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.title}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatRangeChip(item.startKey, item.endKey)}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-accent hover:bg-accent-soft rounded-md px-3 py-1.5 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRangeChip(startKey: string, endKey: string): string {
  const start = new Date(`${startKey}T00:00:00Z`);
  const end = new Date(`${endKey}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return startKey;
  }

  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
