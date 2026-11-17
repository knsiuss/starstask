"use client";

import Link from "next/link";
import * as React from "react";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { APP_TIME_ZONE, toJakartaDateKey } from "@starstask/shared";

import { WeekDayColumn } from "@/components/dashboard/week-day-column";
import { WeekScroller } from "@/components/dashboard/week-scroller";
import type { MyWeek, MyWeekItem } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";

const DAY_MS = 86_400_000;
const MAX_WEEK_OFFSET = 52;
const WEEK_OPTIONS = [-2, -1, 0, 1, 2];

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
});

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

  const close = React.useCallback(() => {
    if (ref.current) {
      ref.current.open = false;
    }
  }, []);

  React.useEffect(() => {
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
  }, [close]);

  return { ref, close };
}

function weekHref(offset: number): string {
  return offset === 0 ? "/app" : `/app?week=${offset}`;
}

function weekOptionLabel(offset: number, currentWeekStart: Date): string {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";

  const start = new Date(currentWeekStart.getTime() + offset * 7 * DAY_MS);

  return `Week of ${dayMonthFormatter.format(start)}`;
}

/**
 * One week at a glance: deadlines, sessions, and the student's own absences.
 *
 * Days are grouped in Asia/Jakarta so a late-night deadline never lands on the
 * wrong column. `weekOffset` moves the window; the data layer owns the range.
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
  const { ref: menuRef, close: closeMenu } = useDismissableMenu();
  const atPrevBound = weekOffset <= -MAX_WEEK_OFFSET;
  const atNextBound = weekOffset >= MAX_WEEK_OFFSET;
  const rangeLabel = `${dayMonthFormatter.format(weekStart)} - ${dayMonthFormatter.format(
    new Date(weekEnd.getTime() - 1),
  )}`;

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
      className="border-border bg-surface rise-in rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <CalendarDays
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <div className="min-w-0">
            <h2
              id="my-week"
              className="text-foreground text-base font-semibold tracking-tight"
            >
              My week
            </h2>
            <p className="text-muted-foreground text-xs tabular-nums">
              {rangeLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={weekHref(0)}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors",
              weekOffset === 0
                ? "border-accent/30 bg-accent-soft text-accent"
                : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            Today
          </Link>

          {[
            {
              disabled: atPrevBound,
              offset: weekOffset - 1,
              label: "Previous week",
              Icon: ChevronLeft,
            },
            {
              disabled: atNextBound,
              offset: weekOffset + 1,
              label: "Next week",
              Icon: ChevronRight,
            },
          ].map(({ disabled, offset, label, Icon }) =>
            disabled ? (
              <span
                key={label}
                aria-disabled="true"
                className="border-border text-muted-foreground/50 inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md border"
              >
                <Icon
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </span>
            ) : (
              <Link
                key={label}
                href={weekHref(offset)}
                aria-label={label}
                className="border-border text-muted-foreground hover:bg-hover hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
              >
                <Icon
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </Link>
            ),
          )}

          <details
            ref={menuRef}
            className="relative"
          >
            <summary className="border-border text-muted-foreground hover:bg-hover hover:text-foreground inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors [&::-webkit-details-marker]:hidden">
              Week
              <ChevronDown
                aria-hidden="true"
                className="h-3 w-3"
              />
            </summary>

            <div className="border-border bg-surface absolute right-0 z-20 mt-1 w-48 rounded-lg border p-1 shadow-sm">
              <ul>
                {WEEK_OPTIONS.map((offset) => (
                  <li key={offset}>
                    <Link
                      href={weekHref(offset)}
                      onClick={closeMenu}
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
                  onClick={closeMenu}
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
        {/* On desktop (`lg+`), all 7 days fit side-by-side without horizontal
            scroll; narrower screens scroll sideways instead of squeezing. */}
        <ol className="grid w-max min-w-full grid-flow-col auto-cols-[minmax(8.5rem,1fr)] gap-2 lg:w-full lg:grid-flow-row lg:grid-cols-7 lg:auto-cols-auto">
          {days.map((day) => (
            <WeekDayColumn
              key={day.key}
              date={day.date}
              items={itemsByDay.get(day.key) ?? []}
              isToday={day.key === todayKey}
              canScheduleSessions={canScheduleSessions}
            />
          ))}
        </ol>
      </WeekScroller>
    </section>
  );
}
