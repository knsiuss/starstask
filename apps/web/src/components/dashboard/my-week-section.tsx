import {
  CalendarDays,
  ClipboardList,
  ChevronRight,
  Plane,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import type { MyWeek, MyWeekItem, MyWeekItemKind } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";
import { APP_TIME_ZONE, toJakartaDateKey } from "@starstask/shared";

const KIND_ICONS: Record<MyWeekItemKind, LucideIcon> = {
  assignment: ClipboardList,
  session: Video,
  leave: Plane,
};

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function describeDay(dateKey: string, todayKey: string, tomorrowKey: string) {
  if (dateKey === todayKey) {
    return "Today";
  }

  if (dateKey === tomorrowKey) {
    return "Tomorrow";
  }

  return dayFormatter.format(new Date(`${dateKey}T00:00:00+07:00`));
}

function groupByDay(items: MyWeekItem[]): Array<[string, MyWeekItem[]]> {
  const groups = new Map<string, MyWeekItem[]>();

  for (const item of items) {
    const dateKey = toJakartaDateKey(item.at);
    const bucket = groups.get(dateKey);

    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(dateKey, [item]);
    }
  }

  return [...groups.entries()];
}

type MyWeekSectionProps = {
  week: MyWeek;
  nowIso: string;
};

/**
 * One week at a glance: deadlines, sessions, and the student's own absences.
 *
 * Grouping is done in Asia/Jakarta so a late-night deadline never lands on the
 * wrong day for the person reading it.
 */
export function MyWeekSection({ week, nowIso }: MyWeekSectionProps) {
  const now = new Date(nowIso);
  const todayKey = toJakartaDateKey(now);
  const tomorrowKey = toJakartaDateKey(new Date(now.getTime() + 86_400_000));
  const groups = groupByDay(week.items);

  return (
    <section
      aria-labelledby="my-week"
      className="mt-8"
    >
      <SectionHeader
        id="my-week"
        title="My week"
        description="Deadlines, sessions, and your absences for the next seven days."
        action={{ href: "/sessions", label: "Schedule" }}
      />

      <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        {groups.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CalendarDays
              aria-hidden="true"
              className="text-muted-foreground mx-auto h-5 w-5"
            />
            <p className="mt-2 text-sm font-medium">Nothing due this week</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
              New deadlines, sessions, and absence updates will appear here as
              they are added.
            </p>
          </div>
        ) : (
          <div className="divide-border divide-y">
            {groups.map(([dateKey, items]) => {
              const isToday = dateKey === todayKey;

              return (
                <div key={dateKey}>
                  <p
                    className={cn(
                      "px-4 py-2 text-[11px] font-medium tracking-[0.08em] uppercase sm:px-5",
                      isToday
                        ? "bg-accent-soft text-accent"
                        : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {describeDay(dateKey, todayKey, tomorrowKey)}
                  </p>
                  <ul className="divide-border divide-y">
                    {items.map((item) => {
                      const Icon = KIND_ICONS[item.kind];

                      return (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            className="hover:bg-hover focus-visible:outline-accent group flex items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5"
                          >
                            <span
                              aria-hidden="true"
                              className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            >
                              <Icon className="h-4 w-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-foreground group-hover:text-accent truncate text-sm font-medium">
                                {item.title}
                              </p>
                              <p className="text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                <span className="truncate">
                                  {item.className}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="whitespace-nowrap">
                                  {item.detail}
                                </span>
                              </p>
                            </div>

                            <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">
                              {item.allDay
                                ? "All day"
                                : timeFormatter.format(new Date(item.at))}
                            </span>

                            <ChevronRight
                              aria-hidden="true"
                              className="text-muted-foreground/70 h-4 w-4 shrink-0"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
