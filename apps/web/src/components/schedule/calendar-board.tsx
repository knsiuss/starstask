import Link from "next/link";

import {
  CalendarEventChip,
  CalendarEventRow,
} from "@/components/schedule/calendar-event-chip";
import type {
  CalendarClassOption,
  CalendarEvent,
  CalendarSubjectOption,
} from "@/lib/db/calendar";
import { cn } from "@/lib/utils/cn";
import type { CalendarQuery } from "@starstask/contracts";
import {
  calendarEventDateKey,
  formatCalendarDayLabel,
  formatCalendarShortDay,
  type CalendarRange,
} from "@starstask/shared";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarBoardProps = {
  range: CalendarRange;
  events: CalendarEvent[];
  query: CalendarQuery;
  classes: CalendarClassOption[];
  subjects: CalendarSubjectOption[];
  todayKey: string;
};

function dayHref(dateKey: string, query: CalendarQuery): string {
  const params = new URLSearchParams({ view: "day", date: dateKey });

  if (query.type !== "all") {
    params.set("type", query.type);
  }

  if (query.class) {
    params.set("class", query.class);
  }

  if (query.subject) {
    params.set("subject", query.subject);
  }

  return `/schedule?${params.toString()}`;
}

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = calendarEventDateKey(event.startsAt);

    if (!key) {
      continue;
    }

    const bucket = grouped.get(key);

    if (bucket) {
      bucket.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }

  return grouped;
}

export function CalendarBoard({
  range,
  events,
  query,
  classes,
  subjects,
  todayKey,
}: CalendarBoardProps) {
  const byDay = groupByDay(events);
  const sharedProps = {
    classes,
    subjects,
    defaultDateKey: range.anchorKey,
  };

  if (range.view === "month") {
    return (
      <div className="border-border bg-surface rounded-xl border p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-muted-foreground py-1 text-center text-[11px] font-medium tracking-[0.06em] uppercase"
            >
              {label}
            </div>
          ))}

          {range.days.map((day) => {
            const dayEvents = byDay.get(day.dateKey) ?? [];

            return (
              <div
                key={day.dateKey}
                className={cn(
                  "border-border min-h-24 rounded-md border p-1.5",
                  day.inMonth ? "bg-surface" : "bg-subtle opacity-60",
                  day.dateKey === todayKey && "border-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={dayHref(day.dateKey, query)}
                    className={cn(
                      "text-muted-foreground text-xs font-medium tabular-nums hover:underline",
                      day.dateKey === todayKey && "text-accent",
                    )}
                  >
                    {day.dayOfMonth}
                  </Link>
                  {dayEvents.length > 0 ? (
                    <span className="text-muted-foreground text-[10px]">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <CalendarEventChip
                      key={event.key}
                      event={event}
                      {...sharedProps}
                    />
                  ))}
                  {dayEvents.length > 3 ? (
                    <Link
                      href={dayHref(day.dateKey, query)}
                      className="text-muted-foreground block px-1.5 text-[11px] hover:underline"
                    >
                      +{dayEvents.length - 3} more
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {events.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Nothing scheduled in this month for the selected filters.
          </p>
        ) : null}
      </div>
    );
  }

  if (range.view === "week") {
    return (
      <div className="grid gap-2 sm:grid-cols-7">
        {range.days.map((day) => {
          const dayEvents = byDay.get(day.dateKey) ?? [];

          return (
            <div
              key={day.dateKey}
              className={cn(
                "border-border bg-surface min-h-40 rounded-lg border p-2",
                day.dateKey === todayKey && "border-accent",
              )}
            >
              <Link
                href={dayHref(day.dateKey, query)}
                className={cn(
                  "text-muted-foreground hover:text-foreground text-xs font-medium",
                  day.dateKey === todayKey && "text-accent",
                )}
              >
                {formatCalendarShortDay(day.dateKey)}
              </Link>
              <div className="mt-2 space-y-1.5">
                {dayEvents.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">—</p>
                ) : (
                  dayEvents.map((event) => (
                    <CalendarEventChip
                      key={event.key}
                      event={event}
                      {...sharedProps}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (range.view === "day") {
    if (events.length === 0) {
      return (
        <EmptyDay
          title="Nothing scheduled today"
          description="Pick another day, change the filters, or add a personal event."
        />
      );
    }

    return (
      <div className="space-y-2">
        {events.map((event) => (
          <CalendarEventRow
            key={event.key}
            event={event}
            {...sharedProps}
          />
        ))}
      </div>
    );
  }

  const daysWithEvents = range.days.filter(
    (day) => (byDay.get(day.dateKey)?.length ?? 0) > 0,
  );

  if (daysWithEvents.length === 0) {
    return (
      <EmptyDay
        title="No events in this agenda"
        description="Use the arrows to move through the next thirty days, or change the filters."
      />
    );
  }

  return (
    <div className="space-y-6">
      {daysWithEvents.map((day) => {
        const dayEvents = byDay.get(day.dateKey) ?? [];

        return (
          <section
            key={day.dateKey}
            aria-label={formatCalendarDayLabel(day.dateKey)}
          >
            <div className="flex items-center justify-between gap-3">
              <h3
                className={cn(
                  "text-sm font-semibold tracking-tight",
                  day.dateKey === todayKey && "text-accent",
                )}
              >
                {formatCalendarDayLabel(day.dateKey)}
              </h3>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {dayEvents.length}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {dayEvents.map((event) => (
                <CalendarEventRow
                  key={event.key}
                  event={event}
                  {...sharedProps}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EmptyDay({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
        {description}
      </p>
    </div>
  );
}
