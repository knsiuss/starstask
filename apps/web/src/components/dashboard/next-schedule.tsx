import { ArrowRight, CalendarDays, FileText } from "lucide-react";
import Link from "next/link";

import type { NextScheduleItem } from "@/lib/db/dashboard";

const TIME_ZONE = "Asia/Jakarta";

const itemFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatWhen(item: NextScheduleItem): string {
  const date = itemFormatter.format(new Date(item.at));
  const time = timeFormatter.format(new Date(item.at));

  return item.kind === "session" && item.endsAt
    ? `${date}, ${time} – ${timeFormatter.format(new Date(item.endsAt))}`
    : `${date} at ${time}`;
}

/**
 * The nearest upcoming deadline or session. Stays in step with the stats
 * and My week because getNextSchedule reads the same two sources.
 */
export function NextSchedule({ item }: { item: NextScheduleItem | null }) {
  return (
    <section
      aria-labelledby="next-schedule"
      className="border-border bg-surface rise-in rounded-xl border p-3.5 shadow-[0_1px_2px_rgba(9,9,11,0.03)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-lg">
            <CalendarDays
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            />
          </span>
          <h2
            id="next-schedule"
            className="text-foreground text-base font-semibold tracking-tight sm:text-lg"
          >
            Next Schedule
          </h2>
        </div>
        <Link
          href="/schedule"
          className="text-accent hover:text-accent-hover inline-flex items-center gap-1.5 rounded-md text-xs font-semibold transition-colors"
        >
          View all tasks
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      {item ? (
        <Link
          href={item.href}
          className="border-accent/20 bg-band hover:border-accent/40 focus-visible:outline-accent mt-3 flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-4 sm:py-3.5"
        >
          <span className="bg-surface text-accent border-border flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            {item.kind === "assignment" ? (
              <FileText
                aria-hidden="true"
                className="h-5 w-5"
              />
            ) : (
              <CalendarDays
                aria-hidden="true"
                className="h-5 w-5"
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-sm font-semibold">
              {item.title}
            </span>
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">
              {item.className} · {item.detail}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs tabular-nums">
              Scheduled for · {formatWhen(item)}
            </span>
          </span>
          <span className="bg-surface text-accent border-border inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
            <span
              aria-hidden="true"
              className="bg-accent h-1.5 w-1.5 rounded-full"
            />
            Planned
          </span>
        </Link>
      ) : (
        <p className="text-muted-foreground mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          No upcoming deadlines or sessions. Enjoy the free time — or{" "}
          <Link
            href="/schedule"
            className="text-accent font-medium underline-offset-4 hover:underline"
          >
            browse the full schedule
          </Link>
          .
        </p>
      )}
    </section>
  );
}
