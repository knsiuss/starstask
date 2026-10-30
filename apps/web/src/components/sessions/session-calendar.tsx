import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { SessionStatusBadge } from "@/components/sessions/session-status-badge";
import type { SessionSummary } from "@/lib/db/sessions";
import {
  buildCalendarMonth,
  formatMonthLabel,
  formatSessionTime,
  shiftMonth,
  toDateKey,
} from "@starstask/shared";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type SessionCalendarProps = {
  sessions: SessionSummary[];
  year: number;
  month: number;
  /** Page that owns the calendar, e.g. `/sessions`. */
  basePath: string;
  /** Filters to preserve when moving between months. */
  params?: Record<string, string | undefined>;
};

/**
 * Month grid.
 *
 * Rendering happens on the server and navigation is plain links, so the
 * calendar works without JavaScript and never ships the whole session list to
 * the browser just to lay it out.
 */
export function SessionCalendar({
  sessions,
  year,
  month,
  basePath,
  params = {},
}: SessionCalendarProps) {
  const weeks = buildCalendarMonth(year, month);
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const byDay = new Map<string, SessionSummary[]>();

  for (const session of sessions) {
    const key = toDateKey(session.startsAt, session.timeZone);

    if (!key) {
      continue;
    }

    const bucket = byDay.get(key);

    if (bucket) {
      bucket.push(session);
    } else {
      byDay.set(key, [session]);
    }
  }

  return (
    <div className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={monthHref(basePath, params, previous.year, previous.month)}
          aria-label="Previous month"
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ChevronLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Link>
        <h2
          aria-live="polite"
          className="text-sm font-semibold tracking-tight"
        >
          {formatMonthLabel(year, month)}
        </h2>
        <Link
          href={monthHref(basePath, params, next.year, next.month)}
          aria-label="Next month"
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-muted-foreground py-1 text-center text-[11px] font-medium tracking-[0.06em] uppercase"
          >
            {label}
          </div>
        ))}

        {weeks.flat().map((day) => {
          const daySessions = byDay.get(day.dateKey) ?? [];

          return (
            <div
              key={day.dateKey}
              className={`border-border min-h-24 rounded-md border p-1.5 ${
                day.inMonth ? "bg-surface" : "bg-subtle opacity-60"
              }`}
            >
              <p className="text-muted-foreground text-xs font-medium">
                {day.dayOfMonth}
              </p>
              <ul className="mt-1 space-y-1">
                {daySessions.slice(0, 3).map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/sessions/${session.id}`}
                      className={`block truncate rounded px-1.5 py-1 text-[11px] leading-tight ${
                        session.status === "cancelled"
                          ? "bg-danger-soft text-danger line-through"
                          : "bg-accent-soft text-accent hover:bg-accent hover:text-accent-foreground"
                      }`}
                      title={`${session.title} · ${formatSessionTime(session.startsAt, session.timeZone)}`}
                    >
                      {formatSessionTime(session.startsAt, session.timeZone)}{" "}
                      {session.title}
                    </Link>
                  </li>
                ))}
                {daySessions.length > 3 ? (
                  <li className="text-muted-foreground px-1.5 text-[11px]">
                    +{daySessions.length - 3} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Nothing scheduled this month.
        </p>
      ) : (
        <ul className="text-muted-foreground mt-4 flex flex-wrap gap-3 text-[11px]">
          <li className="inline-flex items-center gap-1.5">
            <SessionStatusBadge status="scheduled" />
            Scheduled
          </li>
          <li className="inline-flex items-center gap-1.5">
            <SessionStatusBadge status="cancelled" />
            Cancelled
          </li>
        </ul>
      )}
    </div>
  );
}

function monthHref(
  basePath: string,
  params: Record<string, string | undefined>,
  year: number,
  month: number,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  search.set("view", "calendar");
  search.set("month", `${year}-${String(month).padStart(2, "0")}`);

  return `${basePath}?${search.toString()}`;
}
