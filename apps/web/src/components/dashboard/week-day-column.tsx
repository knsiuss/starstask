import Link from "next/link";

import { Plus } from "lucide-react";

import { APP_TIME_ZONE } from "@starstask/shared";

import type { MyWeekItem, MyWeekItemKind } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";

const MAX_ITEMS_PER_DAY = 3;

const KIND_LABEL: Record<MyWeekItemKind, string> = {
  assignment: "Task",
  session: "Session",
  leave: "Leave",
};

const KIND_TEXT: Record<MyWeekItemKind, string> = {
  assignment: "text-warning",
  session: "text-accent",
  leave: "text-success",
};

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
});

const dayNumberFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type WeekDayColumnProps = {
  date: Date;
  items: MyWeekItem[];
  isToday: boolean;
  canScheduleSessions: boolean;
};

function formatItemTime(item: MyWeekItem): string {
  if (item.allDay) {
    return "All day";
  }

  const start = timeFormatter.format(new Date(item.at));

  return item.endsAt
    ? `${start} - ${timeFormatter.format(new Date(item.endsAt))}`
    : start;
}

/**
 * Single day column inside the weekly timeline, showing up to three events
 * and a link to the full schedule when more exist.
 */
export function WeekDayColumn({
  date,
  items,
  isToday,
  canScheduleSessions,
}: WeekDayColumnProps) {
  const visible = items.slice(0, MAX_ITEMS_PER_DAY);
  const hidden = items.length - visible.length;

  return (
    <li
      data-today={isToday ? "true" : undefined}
      className={cn(
        "flex min-h-36 snap-start flex-col rounded-lg border p-2.5",
        isToday
          ? "border-accent/50 bg-accent-soft/25"
          : "border-border bg-subtle/40",
      )}
    >
      <div
        className={cn(
          "flex items-baseline justify-between gap-1 border-b pb-2",
          isToday ? "border-accent/20" : "border-border",
        )}
      >
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase",
              isToday ? "text-accent" : "text-muted-foreground",
            )}
          >
            {weekdayFormatter.format(date)}
          </span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              isToday ? "text-accent" : "text-foreground",
            )}
          >
            {dayNumberFormatter.format(date)}
          </span>
        </div>

        {isToday ? (
          <span className="text-accent text-[10px] font-semibold">Today</span>
        ) : items.length > 0 ? (
          <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
            {items.length}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4">
          <p className="text-muted-foreground text-[11px]">No events</p>
          {canScheduleSessions ? (
            <Link
              href="/sessions/new"
              aria-label={`Add an event on ${dayMonthFormatter.format(date)}`}
              className="border-border text-muted-foreground hover:bg-hover hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
            >
              <Plus
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {visible.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="border-border bg-surface hover:border-accent/40 hover:bg-hover focus-visible:outline-accent block rounded-md border px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <span className="text-foreground block truncate text-xs font-medium">
                  {item.title}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-1 text-[10px] tabular-nums">
                  <span className="text-muted-foreground truncate">
                    {formatItemTime(item)}
                  </span>
                  <span
                    className={cn("shrink-0 font-medium", KIND_TEXT[item.kind])}
                  >
                    {KIND_LABEL[item.kind]}
                  </span>
                </span>
              </Link>
            </li>
          ))}

          {hidden > 0 ? (
            <li>
              <Link
                href="/schedule"
                className="text-accent hover:text-accent-hover block px-1 py-0.5 text-[11px] font-medium underline-offset-4 hover:underline"
              >
                +{hidden} more
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </li>
  );
}
