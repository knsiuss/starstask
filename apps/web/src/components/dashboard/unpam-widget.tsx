import Link from "next/link";

import { ArrowRight, Calendar, MapPin } from "lucide-react";

import type { PluginEvent } from "@/features/plugins/types";

/** Dashboard rail widget: up to 3 upcoming UNPAM events. Rendered only for UNPAM members. */
export function UnpamWidget({ events }: { events: PluginEvent[] }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((event) => event.startsAt >= todayKey)
    .slice(0, 3);

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="unpam-widget-heading"
      className="border-border bg-surface rounded-xl border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            id="unpam-widget-heading"
            className="text-foreground truncate text-[15px] font-semibold tracking-tight"
          >
            University info
          </h2>
          <span className="border-border bg-subtle text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium">
            UNPAM
          </span>
        </div>

        <Link
          href="/university-info"
          className="text-accent hover:text-accent-hover focus-visible:outline-accent inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span>View all</span>
          <ArrowRight
            aria-hidden="true"
            className="h-3 w-3"
          />
        </Link>
      </div>

      <ul className="divide-border/60 mt-3 divide-y">
        {upcoming.map((event, index) => (
          <li
            key={`${event.title}-${event.startsAt}-${index}`}
            className="py-2.5 first:pt-0 last:pb-0"
          >
            <p className="text-foreground line-clamp-1 text-sm font-medium">
              {event.title}
            </p>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0"
                />
                {event.startsAt}
              </span>
              {event.location ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0"
                  />
                  <span className="truncate">{event.location}</span>
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
