import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { CalendarBoard } from "@/components/schedule/calendar-board";
import { CalendarFilters } from "@/components/schedule/calendar-filters";
import { CALENDAR_EVENT_TONES } from "@/components/schedule/calendar-event-style";
import { EventFormDialog } from "@/components/schedule/event-form-dialog";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { listCalendarEvents } from "@/lib/db/calendar";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import { flattenSearchParams } from "@/lib/utils/search-params";
import {
  CALENDAR_EVENT_TYPE_LABELS,
  CALENDAR_VIEWS,
  calendarQuerySchema,
  type CalendarEventType,
  type CalendarQuery,
  type CalendarView,
} from "@starstask/contracts";
import {
  buildCalendarViewRange,
  formatCalendarDayLabel,
  formatCalendarMonthLabel,
  isCalendarDateKey,
  shiftCalendarAnchor,
  todayDateKey,
} from "@starstask/shared";

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "Class hours, assignment deadlines, exams, academic events, and personal events in one calendar.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10";

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
};

type SchedulePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SchedulePage({
  searchParams,
}: SchedulePageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <h1 className="text-3xl font-semibold tracking-tight">Schedule</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(buildLoginPath("/schedule"));
  }

  const flat = flattenSearchParams(await searchParams);
  const parsed = calendarQuerySchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <h1 className="text-3xl font-semibold tracking-tight">Schedule</h1>
        <Alert
          variant="error"
          className="mt-6"
        >
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/schedule"
              className="underline"
            >
              Reset the calendar
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const query = parsed.data;
  const today = todayDateKey();
  const anchorKey =
    query.date && isCalendarDateKey(query.date) ? query.date : today;
  const range = buildCalendarViewRange(query.view, anchorKey);

  const data = await listCalendarEvents(viewer.user.id, query, range);
  const adminClasses = data.classes.filter((item) => item.isAdmin);

  const rangeLabel =
    query.view === "month"
      ? formatCalendarMonthLabel(anchorKey)
      : query.view === "day"
        ? formatCalendarDayLabel(anchorKey)
        : `${formatCalendarDayLabel(range.startKey)} – ${formatCalendarDayLabel(range.endKey)}`;

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Schedule
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            One calendar for class hours, assignment deadlines, exams, academic
            events, and your own events. Everyone in a class sees the same
            schedule; only class admins can change official events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.storageReady ? (
            <EventFormDialog
              scope="personal"
              defaultDateKey={anchorKey}
              triggerLabel={
                <>
                  <UserRound
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Personal event
                </>
              }
              triggerVariant="secondary"
            />
          ) : null}
          {data.storageReady && adminClasses.length > 0 ? (
            <EventFormDialog
              scope="official"
              defaultDateKey={anchorKey}
              classes={data.classes}
              subjects={data.subjects}
              triggerLabel={
                <>
                  <PlusCircle
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Official event
                </>
              }
            />
          ) : null}
        </div>
      </header>

      {!data.storageReady ? (
        <Alert
          variant="warning"
          className="mt-6"
        >
          <p className="font-medium">Calendar storage is not deployed yet.</p>
          <p className="mt-1 text-xs leading-relaxed">
            The database migration that adds personal and official events has
            not been applied. Assignment deadlines, discussion sessions, and the
            weekly timetable still appear; creating or editing events will fail
            until an administrator applies it.
          </p>
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Calendar views"
          className="bg-muted inline-flex rounded-lg p-1"
        >
          {CALENDAR_VIEWS.map((view) => (
            <Link
              key={view}
              href={scheduleHref(query, anchorKey, { view })}
              aria-current={view === query.view ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === query.view
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABELS[view]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href={scheduleHref(query, anchorKey, {
              date: shiftCalendarAnchor(query.view, anchorKey, -1),
            })}
            aria-label="Previous period"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
          >
            <ChevronLeft
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Link>
          <p
            aria-live="polite"
            className="min-w-44 text-center text-sm font-medium"
          >
            {rangeLabel}
          </p>
          <Link
            href={scheduleHref(query, anchorKey, {
              date: shiftCalendarAnchor(query.view, anchorKey, 1),
            })}
            aria-label="Next period"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
          >
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Link>
          <Link
            href={scheduleHref(query, anchorKey, { date: today })}
            className="text-muted-foreground hover:bg-muted hover:text-foreground ml-1 rounded-md px-2.5 py-1.5 text-xs font-medium"
          >
            Today
          </Link>
        </div>
      </div>

      <CalendarFilters
        view={query.view}
        anchorKey={anchorKey}
        query={query}
        classes={data.classes}
        subjects={data.subjects}
      />

      <div className="mt-5">
        <CalendarBoard
          range={range}
          events={data.events}
          query={query}
          classes={data.classes}
          subjects={data.subjects}
          todayKey={today}
        />
      </div>

      <Legend />

      <p className="text-muted-foreground mt-5 flex items-start gap-1.5 text-xs leading-relaxed">
        <CalendarClock
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
        />
        Everything is shown in Asia/Jakarta (WIB). Assignment deadlines and
        discussion sessions are read from their own records, so a change there
        appears here immediately. Official events are cancelled or archived
        rather than deleted, which keeps the group history intact.
      </p>
    </div>
  );
}

function Legend() {
  const types = Object.keys(CALENDAR_EVENT_TONES) as Array<
    Exclude<CalendarEventType, "all">
  >;

  return (
    <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
      {types.map((type) => (
        <li
          key={type}
          className="inline-flex items-center gap-1.5"
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full bg-current",
              CALENDAR_EVENT_TONES[type],
            )}
          />
          {CALENDAR_EVENT_TYPE_LABELS[type]}
        </li>
      ))}
    </ul>
  );
}

function scheduleHref(
  query: CalendarQuery,
  anchorKey: string,
  overrides: { view?: CalendarView; date?: string },
): string {
  const params = new URLSearchParams();

  params.set("view", overrides.view ?? query.view);
  params.set("date", overrides.date ?? anchorKey);

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
