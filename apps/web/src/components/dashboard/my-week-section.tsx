"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { MyWeek, MyWeekItem, MyWeekItemKind } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";
import { WeekScroller } from "@/components/dashboard/week-scroller";
import { APP_TIME_ZONE, toJakartaDateKey } from "@starstask/shared";

const DAY_MS = 86_400_000;

/** Mirrors MAX_WEEK_OFFSET in the dashboard page; the data layer clamps too. */
const MAX_WEEK_OFFSET = 52;

const KIND_BORDER: Record<MyWeekItemKind, string> = {
  assignment: "border-l-warning",
  session: "border-l-accent",
  leave: "border-l-success",
};

const KIND_TINT: Record<MyWeekItemKind, string> = {
  assignment: "bg-warning-soft",
  session: "bg-accent-soft",
  leave: "bg-success-soft",
};

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
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

const MAX_ITEMS_PER_DAY = 3;

type MyWeekSectionProps = {
  week: MyWeek;
  nowIso: string;
  weekOffset: number;
  /** Only class admins can create sessions; students get no add buttons. */
  canScheduleSessions?: boolean;
};

/** Closes a native details menu on outside click or Escape. */
function useDismissableMenu() {
  const ref = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    const close = () => {
      if (ref.current) {
        ref.current.open = false;
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      const el = ref.current;

      if (el?.open && !el.contains(event.target as Node)) {
        close();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return ref;
}

function weekHref(offset: number): string {
  return offset === 0 ? "/dashboard" : `/dashboard?week=${offset}`;
}

/** Labels a week relative to the current one, so the menu reads naturally. */
function weekOptionLabel(offset: number, currentWeekStart: Date): string {
  if (offset === 0) {
    return "This week";
  }

  if (offset === -1) {
    return "Last week";
  }

  if (offset === 1) {
    return "Next week";
  }

  const start = new Date(currentWeekStart.getTime() + offset * 7 * DAY_MS);

  return `Week of ${dayMonthFormatter.format(start)}`;
}

/**
 * One week at a glance: deadlines, sessions, and the student's own absences.
 *
 * Days are grouped in Asia/Jakarta so a late-night deadline never lands on the
 * wrong column. `weekOffset` moves the window; the data layer owns the range so
 * the UI never has to guess which rows belong to which week.
 */
export function MyWeekSection({
  week,
  nowIso,
  weekOffset,
  canScheduleSessions = false,
}: MyWeekSectionProps) {
  const todayKey = toJakartaDateKey(new Date(nowIso));
  const weekStart = new Date(week.weekStartIso);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const currentWeekStart = new Date(
    weekStart.getTime() - weekOffset * 7 * DAY_MS,
  );
  const menuRef = useDismissableMenu();
  const atPrevBound = weekOffset <= -MAX_WEEK_OFFSET;
  const atNextBound = weekOffset >= MAX_WEEK_OFFSET;
  const rangeLabel = `${dayMonthFormatter.format(weekStart)} – ${dayMonthFormatter.format(
    new Date(weekEnd.getTime() - 1),
  )}`;
  const weekOptions = [-2, -1, 0, 1, 2];
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart.getTime() + index * DAY_MS);

    return {
      key: toJakartaDateKey(day),
      date: day,
    };
  });

  const itemsByDay = new Map<string, MyWeekItem[]>();

  for (const item of week.items) {
    const key = toJakartaDateKey(item.at);
    const bucket = itemsByDay.get(key);

    if (bucket) {
      bucket.push(item);
    } else {
      itemsByDay.set(key, [item]);
    }
  }

  return (
    <section
      aria-labelledby="my-week"
      className="border-border bg-surface rise-in rounded-xl border p-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <CalendarDays
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            />
          </span>
          <div className="min-w-0">
            <h2
              id="my-week"
              className="text-foreground text-base font-semibold tracking-tight sm:text-lg"
            >
              My week
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Deadlines, sessions, and your absences for the selected week.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={weekHref(0)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              weekOffset === 0
                ? "border-accent/30 bg-accent-soft text-accent"
                : "border-border text-muted-foreground hover:bg-hover",
            )}
          >
            Today
          </Link>
          {atPrevBound ? (
            <span
              aria-disabled="true"
              className="border-border text-muted-foreground/50 cursor-not-allowed rounded-md border p-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </span>
          ) : (
            <Link
              href={weekHref(weekOffset - 1)}
              aria-label="Previous week"
              className="border-border text-muted-foreground hover:bg-hover hover:text-foreground rounded-md border p-1.5 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          )}
          {atNextBound ? (
            <span
              aria-disabled="true"
              className="border-border text-muted-foreground/50 cursor-not-allowed rounded-md border p-1.5"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          ) : (
            <Link
              href={weekHref(weekOffset + 1)}
              aria-label="Next week"
              className="border-border text-muted-foreground hover:bg-hover hover:text-foreground rounded-md border p-1.5 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}

          <span className="text-muted-foreground px-1 text-xs font-medium tabular-nums">
            {rangeLabel}
          </span>

          <details
            ref={menuRef}
            className="relative"
          >
            <summary className="border-border text-muted-foreground hover:bg-hover hover:text-foreground flex cursor-pointer list-none items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors [&::-webkit-details-marker]:hidden">
              Week
              <ChevronDown
                aria-hidden="true"
                className="h-3 w-3"
              />
            </summary>

            <div className="border-border bg-surface absolute right-0 z-20 mt-1 w-48 rounded-lg border p-1 shadow-lg">
              <ul>
                {weekOptions.map((offset) => (
                  <li key={offset}>
                    <Link
                      href={weekHref(offset)}
                      aria-current={offset === weekOffset ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors",
                        offset === weekOffset
                          ? "bg-accent-soft text-accent font-semibold"
                          : "text-foreground hover:bg-hover",
                      )}
                    >
                      {weekOptionLabel(offset, currentWeekStart)}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="border-border mt-1 border-t pt-1">
                <Link
                  href="/schedule"
                  className="text-muted-foreground hover:bg-hover hover:text-foreground flex items-center rounded-md px-2.5 py-1.5 text-xs transition-colors"
                >
                  Open full schedule
                </Link>
              </div>
            </div>
          </details>
        </div>
      </div>

      <WeekScroller>
        {/* `w-max` lets the grid grow past the viewport so narrow screens
            scroll sideways; without it the columns squeeze and clip. */}
        <ol className="grid w-max min-w-full grid-flow-col auto-cols-[minmax(7rem,1fr)] gap-2">
          {days.map((day) => {
            const isToday = day.key === todayKey;
            const items = itemsByDay.get(day.key) ?? [];
            const visible = items.slice(0, MAX_ITEMS_PER_DAY);
            const hidden = items.length - visible.length;

            return (
              <li
                key={day.key}
                data-today={isToday ? "true" : undefined}
                className={cn(
                  // A floor, not a ceiling: grid stretch keeps every column the
                  // same height while a busy day can grow instead of clipping.
                  "flex min-h-40 snap-start flex-col rounded-xl border p-3 sm:min-h-44",
                  isToday
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-subtle/40",
                )}
              >
                <div className="text-center">
                  <p
                    className={cn(
                      "text-[11px] font-semibold tracking-wider uppercase",
                      isToday ? "" : "text-muted-foreground",
                    )}
                  >
                    {weekdayFormatter.format(day.date)}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-semibold tabular-nums",
                      isToday ? "" : "text-foreground",
                    )}
                  >
                    {dayMonthFormatter.format(day.date)}
                  </p>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3">
                  <CalendarDays
                    aria-hidden="true"
                    className={cn(
                      "h-5 w-5",
                      isToday ? "opacity-80" : "text-muted-foreground",
                    )}
                  />
                  {items.length === 0 ? (
                    <>
                      <p
                        className={cn(
                          "text-[11px]",
                          isToday ? "opacity-80" : "text-muted-foreground",
                        )}
                      >
                        No events
                      </p>
                      {canScheduleSessions ? (
                        <Link
                          href="/sessions/new"
                          aria-label={`Add an event on ${dayMonthFormatter.format(day.date)}`}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                            isToday
                              ? "border-accent-foreground/30 hover:bg-accent-foreground/10"
                              : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
                          )}
                        >
                          <Plus className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                        isToday
                          ? "bg-accent-foreground/15"
                          : "bg-accent-soft text-accent",
                      )}
                    >
                      {items.length} {items.length === 1 ? "event" : "events"}
                    </span>
                  )}
                </div>

                {items.length > 0 ? (
                  <ul className="space-y-1.5">
                    {visible.map((item) => (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          className={cn(
                            "focus-visible:outline-accent block truncate rounded-md border-y border-r border-l-[3px] px-1.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                            isToday
                              ? "border-accent-foreground/20 bg-accent-foreground/10 hover:bg-accent-foreground/20"
                              : cn(
                                  "hover:bg-hover",
                                  KIND_BORDER[item.kind],
                                  KIND_TINT[item.kind],
                                ),
                          )}
                        >
                          <span className="block truncate">{item.title}</span>
                          <span
                            className={cn(
                              "block truncate text-[10px] font-normal tabular-nums",
                              isToday ? "opacity-75" : "text-muted-foreground",
                            )}
                          >
                            {item.allDay
                              ? "All day"
                              : timeFormatter.format(new Date(item.at))}
                            {item.endsAt && !item.allDay
                              ? ` – ${timeFormatter.format(new Date(item.endsAt))}`
                              : null}
                          </span>
                        </Link>
                      </li>
                    ))}

                    {hidden > 0 ? (
                      <li
                        className={cn(
                          "px-1.5 text-[10px] font-medium",
                          isToday ? "opacity-75" : "text-muted-foreground",
                        )}
                      >
                        +{hidden} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      </WeekScroller>
    </section>
  );
}
