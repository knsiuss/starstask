import { ArrowRight, CalendarDays, Clock, FileText } from "lucide-react";
import Link from "next/link";

import type { NextScheduleItem } from "@/lib/db/dashboard";

const TIME_ZONE = "Asia/Jakarta";

const itemFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatWhen(item: NextScheduleItem): string {
  const start = new Date(item.at);
  const date = itemFormatter.format(start);
  const time = timeFormatter.format(start);

  return item.kind === "session" && item.endsAt
    ? `${date}, ${time} - ${timeFormatter.format(new Date(item.endsAt))}`
    : `${date} at ${time}`;
}

/**
 * The nearest upcoming deadline or session. Stays in step with the stats
 * and My week because getNextSchedule reads the same two sources.
 */
export function NextSchedule({ item }: { item: NextScheduleItem | null }) {
  const isAssignment = item?.kind === "assignment";

  return (
    <section
      aria-labelledby="next-schedule"
      className="border-border bg-surface rise-in rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <CalendarDays
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
          <h2
            id="next-schedule"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Next Schedule
          </h2>
        </div>

        <Link
          href="/schedule"
          className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          Full schedule
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      {item ? (
        <Link
          href={item.href}
          className="border-border bg-subtle/60 hover:border-accent/40 hover:bg-hover focus-visible:outline-accent mt-3 flex flex-col gap-3 rounded-lg border px-3.5 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="bg-surface text-accent border-border flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
              {isAssignment ? (
                <FileText
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              ) : (
                <CalendarDays
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-semibold">
                {item.title}
              </p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {item.className}
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
            <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium tabular-nums">
              <Clock
                aria-hidden="true"
                className="text-muted-foreground h-3.5 w-3.5"
              />
              {formatWhen(item)}
            </span>

            <span
              className={
                isAssignment
                  ? "bg-warning-soft text-warning rounded-md px-2 py-0.5 text-[11px] font-medium"
                  : "bg-accent-soft text-accent rounded-md px-2 py-0.5 text-[11px] font-medium"
              }
            >
              {isAssignment ? "Assignment" : "Session"}
            </span>
          </div>
        </Link>
      ) : (
        <div className="border-border bg-subtle/40 mt-3 rounded-lg border border-dashed px-4 py-5 text-center">
          <p className="text-muted-foreground text-sm">
            No upcoming deadlines or sessions.
          </p>
          <Link
            href="/schedule"
            className="text-accent hover:text-accent-hover mt-1.5 inline-block text-xs font-medium underline-offset-4 hover:underline"
          >
            Browse full schedule
          </Link>
        </div>
      )}
    </section>
  );
}
