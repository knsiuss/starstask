import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import type { MyWeek, MyWeekItem, MyWeekItemKind } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";
import { WeekScroller } from "@/components/dashboard/week-scroller";
import { APP_TIME_ZONE, toJakartaDateKey } from "@starstask/shared";

const DAY_MS = 86_400_000;

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
};

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
}: MyWeekSectionProps) {
  const todayKey = toJakartaDateKey(new Date(nowIso));
  const weekStart = new Date(week.weekStartIso);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const currentWeekStart = new Date(
    weekStart.getTime() - weekOffset * 7 * DAY_MS,
  );
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
      className="border-border bg-surface rounded-xl border p-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2
            id="my-week"
            className="text-foreground text-base font-semibold tracking-tight sm:text-lg"
          >
            My week
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Deadlines, sessions, and your absences for the selected week.
          </p>
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
          <Link
            href={weekHref(weekOffset - 1)}
            aria-label="Previous week"
            className="border-border text-muted-foreground hover:bg-hover hover:text-foreground rounded-md border p-1.5 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={weekHref(weekOffset + 1)}
            aria-label="Next week"
            className="border-border text-muted-foreground hover:bg-hover hover:text-foreground rounded-md border p-1.5 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <span className="text-muted-foreground px-1 text-xs font-medium tabular-nums">
            {rangeLabel}
          </span>

          <details className="relative">
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
        <ol className="grid w-max auto-cols-[132px] grid-flow-col gap-2">
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
                  "flex h-[224px] snap-start flex-col rounded-lg border p-1.5",
                  isToday
                    ? "border-accent/25 bg-accent-soft/50"
                    : "border-border/70 bg-subtle/40",
                )}
              >
                <div
                  className={cn(
                    "rounded-md px-1.5 py-1 text-center",
                    isToday ? "bg-accent text-accent-foreground" : "",
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-semibold tracking-wide uppercase",
                      isToday ? "" : "text-muted-foreground",
                    )}
                  >
                    {weekdayFormatter.format(day.date)}
                  </p>
                  <p
                    className={cn(
                      "text-[11px] tabular-nums",
                      isToday ? "" : "text-muted-foreground",
                    )}
                  >
                    {dayMonthFormatter.format(day.date)}
                  </p>
                </div>

                <ul
                  className={cn(
                    "mt-1.5 space-y-1.5",
                    items.length > 0 ? "min-h-0 flex-1 overflow-hidden" : "",
                  )}
                >
                  {visible.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={cn(
                          "hover:bg-hover focus-visible:outline-accent block rounded-md border-y border-r border-border border-l-[3px] px-1.5 py-1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                          KIND_BORDER[item.kind],
                          KIND_TINT[item.kind],
                        )}
                      >
                        <span className="text-foreground block truncate text-[11px] font-semibold">
                          {item.title}
                        </span>
                        <span className="text-muted-foreground block truncate text-[10px] tabular-nums">
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
                    <li className="text-muted-foreground px-1.5 text-[10px] font-medium">
                      +{hidden} more
                    </li>
                  ) : null}
                </ul>

                {items.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 py-2">
                    <p className="text-muted-foreground text-[10px]">
                      No events
                    </p>
                    <Link
                      href="/sessions/new"
                      aria-label={`Add an event on ${dayMonthFormatter.format(day.date)}`}
                      className="border-border text-muted-foreground hover:bg-hover hover:text-foreground flex h-6 w-6 items-center justify-center rounded-full border transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </WeekScroller>
    </section>
  );
}
