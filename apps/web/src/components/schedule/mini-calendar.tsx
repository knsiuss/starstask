import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import {
  addDaysToDateKey,
  isCalendarDateKey,
  startOfWeekDateKey,
  todayDateKey,
} from "@starstask/shared";

import { courseColorFor } from "@/lib/schedule/course-colors";
import type { CalendarAssignmentBar } from "@/lib/db/calendar";

type MiniCalendarProps = {
  anchorKey: string;
  /** Days with at least one assignment bar; used for the small marker dot. */
  markedKeys: ReadonlySet<string>;
};

/**
 * Compact month overview. Every day links to the calendar page anchored on
 * that date; marked days carry one dot because listing chips here would fight
 * for space the panel does not have.
 */
export function MiniCalendar({ anchorKey, markedKeys }: MiniCalendarProps) {
  const today = todayDateKey();
  const anchorMonth = anchorKey.slice(0, 7);
  const firstOfMonth = `${anchorMonth}-01`;
  const gridStart = startOfWeekDateKey(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const dateKey = addDaysToDateKey(gridStart, index);

    return {
      dateKey,
      dayOfMonth: Number(dateKey.slice(8, 10)),
      inMonth: dateKey.slice(0, 7) === anchorMonth,
    };
  });
  const prevMonth = shiftMonth(anchorMonth, -1);
  const nextMonth = shiftMonth(anchorMonth, 1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="text-sm font-semibold tracking-tight">
          {formatMonthLabel(anchorMonth)}
        </p>
        <div className="flex items-center gap-0.5">
          <Link
            href={miniMonthHref(prevMonth)}
            aria-label="Previous month"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5"
          >
            ‹
          </Link>
          <Link
            href={miniMonthHref(nextMonth)}
            aria-label="Next month"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="text-muted-foreground pb-1 text-center text-[10px] font-medium tracking-wide"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          const isToday = cell.dateKey === today;
          const marked = markedKeys.has(cell.dateKey);

          return (
            <Link
              key={cell.dateKey}
              href={`/schedule?view=week&date=${cell.dateKey}`}
              aria-label={cell.dateKey}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "relative flex h-8 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors",
                cell.inMonth
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground/60 hover:bg-muted",
                isToday &&
                  "bg-[#0ea5e9] font-semibold text-white hover:bg-[#0ea5e9]",
              )}
            >
              {cell.dayOfMonth}
              {marked ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0.5 h-1 w-1 rounded-full"
                  style={{
                    background: isToday ? "#fff" : "#45639e",
                  }}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Counts one entry per marked day; pass real assignment bars. */
export function buildMarkedKeys(
  assignments: readonly CalendarAssignmentBar[],
): Set<string> {
  const marked = new Set<string>();

  for (const bar of assignments) {
    marked.add(bar.endKey);

    if (bar.startKey !== bar.endKey) {
      // Bars only ship in the current window; mark every covered day.
      let key = bar.startKey;

      while (key <= bar.endKey) {
        marked.add(key);
        key = addDaysToDateKey(key, 1);
      }
    }
  }

  return marked;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [yearRaw = "2000", monthRaw = "01"] = monthKey.split("-");
  const total = Number(yearRaw) * 12 + (Number(monthRaw) - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;

  return `${year}-${String(month).padStart(2, "0")}`;
}

function miniMonthHref(monthKey: string): string {
  const date = isCalendarDateKey(`${monthKey}-01`)
    ? `${monthKey}-01`
    : todayDateKey();

  return `/schedule?view=month&date=${date}`;
}

function formatMonthLabel(monthKey: string): string {
  const date = new Date(`${monthKey}-01T00:00:00Z`);

  return Number.isNaN(date.getTime())
    ? monthKey
    : new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}
