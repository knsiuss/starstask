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
import { EventFormDialog } from "@/components/schedule/event-form-dialog";
import {
  MiniCalendar,
  buildMarkedKeys,
} from "@/components/schedule/mini-calendar";
import {
  CourseFilterPanel,
  type CourseOption,
} from "@/components/schedule/course-filter-panel";
import { TimelineBoard } from "@/components/schedule/timeline-board";
import { TimelineList } from "@/components/schedule/timeline-list";
import { UpcomingAssignments } from "@/components/schedule/upcoming-assignments";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { listCalendarEvents } from "@/lib/db/calendar";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import { flattenSearchParams } from "@/lib/utils/search-params";
import {
  CALENDAR_EVENT_TYPE_LABELS,
  calendarQuerySchema,
  type CalendarQuery,
  type CalendarView,
} from "@starstask/contracts";
import {
  buildCalendarViewRange,
  calendarEventDateKey,
  formatCalendarDayLabel,
  formatCalendarMonthLabel,
  isCalendarDateKey,
  shiftCalendarAnchor,
  todayDateKey,
} from "@starstask/shared";
import type { CalendarEvent } from "@/lib/db/calendar";
import type { TimelineItem } from "@/lib/schedule/timeline";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Assignment deadlines from every class you joined, plotted on one academic timeline.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8";

const VIEW_LABELS: Record<Exclude<CalendarView, "day">, string> = {
  week: "Week",
  month: "Month",
  list: "List",
} as const;

const VISIBLE_VIEWS = Object.keys(VIEW_LABELS) as Array<
  Exclude<CalendarView, "day">
>;

type SchedulePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SchedulePage({
  searchParams,
}: SchedulePageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
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

  const raw = await searchParams;
  const flat = flattenSearchParams(raw);

  // Bookmarks from before the list view shipped keep working.
  if (flat.view === "agenda") {
    const params = new URLSearchParams(rawToParams(raw));

    params.set("view", "list");
    redirect(`/schedule?${params.toString()}`);
  }

  delete flat.subject;

  if (flat.mine === "1") {
    flat.mine = "mine";
  }

  const parsed = calendarQuerySchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
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
  const selected = readSubjectSelection(raw, query.subject);

  const data = await listCalendarEvents(viewer.user.id, query, range);
  const adminClasses = data.classes.filter((item) => item.isAdmin);

  const assignments = data.assignments.filter((assignment) =>
    matchesCourseSelection(assignment, selected),
  );
  const markedKeys = buildMarkedKeys(assignments);
  const courseOptions = buildCourseOptions(data.assignments, data.subjects);

  const items: TimelineItem[] = [
    ...assignments.map((assignment) => assignmentToItem(assignment, today)),
    ...data.events.map(toTimelineItem),
  ];

  const rangeLabel =
    query.view === "month"
      ? formatCalendarMonthLabel(anchorKey)
      : query.view === "day"
        ? formatCalendarDayLabel(anchorKey)
        : `${formatCalendarDayLabel(range.startKey)} – ${formatCalendarDayLabel(range.endKey)}`;

  const isBoardView = query.view === "week" || query.view === "month";

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Every deadline across your classes on one academic timeline.
            Assignment bars span from publication to deadline.
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
          className="mt-5"
        >
          <p className="font-medium">Calendar storage is not deployed yet.</p>
          <p className="mt-1 text-xs leading-relaxed">
            The database migration that adds personal and official events has
            not been applied. Assignment deadlines and discussion sessions still
            appear; creating or editing events will fail until an administrator
            applies it.
          </p>
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Calendar views"
          className="bg-muted inline-flex rounded-lg p-1"
        >
          {VISIBLE_VIEWS.map((view) => (
            <Link
              key={view}
              href={scheduleHref(query, anchorKey, { view }, selected)}
              aria-current={
                view === query.view || (view === "list" && query.view === "day")
                  ? "page"
                  : undefined
              }
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                view === query.view || (view === "list" && query.view === "day")
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
            href={scheduleHref(
              query,
              anchorKey,
              { date: shiftCalendarAnchor(query.view, anchorKey, -1) },
              selected,
            )}
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
            href={scheduleHref(
              query,
              anchorKey,
              { date: shiftCalendarAnchor(query.view, anchorKey, 1) },
              selected,
            )}
            aria-label="Next period"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
          >
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Link>
          <Link
            href={scheduleHref(query, anchorKey, { date: today }, selected)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground ml-1 rounded-md px-2.5 py-1.5 text-xs font-medium"
          >
            Today
          </Link>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {isBoardView ? (
            <TimelineBoard
              view={query.view === "week" ? "week" : "month"}
              days={range.days}
              items={items}
              todayKey={today}
              classes={data.classes}
              subjects={data.subjects}
            />
          ) : (
            <TimelineList
              days={range.days}
              items={items}
              todayKey={today}
            />
          )}

          <div className="mt-5">
            <UpcomingAssignments assignments={assignments} />
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border-border bg-surface rounded-2xl border p-4 shadow-sm">
            <MiniCalendar
              anchorKey={anchorKey}
              markedKeys={markedKeys}
            />
          </div>

          <div className="border-border bg-surface rounded-2xl border p-4 shadow-sm">
            <TypeSelect
              query={query}
              dateKey={anchorKey}
              subjectParams={parseSubjectParams(raw)}
            />
            <CourseFilterPanel
              options={courseOptions}
              selected={selected}
              mine={query.mine === "mine"}
              view={query.view}
              dateKey={anchorKey}
              type={query.type}
              classFilter={query.class}
            />
          </div>

          <Legend />
        </aside>
      </div>

      <p className="text-muted-foreground mt-5 flex items-start gap-1.5 text-xs leading-relaxed">
        <CalendarClock
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
        />
        Everything is shown in Asia/Jakarta (WIB). Assignment bars read their
        data from the assignment record, so publishing, editing, or archiving an
        assignment is reflected here immediately.
      </p>
    </div>
  );
}

type SubjectSelection = Set<string> | null;

type SubjectParams = {
  /** Course identity keys submitted with the form, repeated keys. */
  ids: string[];
  /** True when the form was submitted (even with zero boxes ticked). */
  submitted: boolean;
  /** True when the "All courses" box was ticked. */
  all: boolean;
};

function parseSubjectParams(
  raw: Record<string, string | string[] | undefined>,
): SubjectParams {
  const value = raw["subject"];
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
  const submitted =
    raw["subjectsSet"] === "1" ||
    (Array.isArray(raw["subjectsSet"]) && raw["subjectsSet"][0] === "1");
  const all =
    raw["all"] === "1" || (Array.isArray(raw["all"]) && raw["all"][0] === "1");

  return { ids, submitted, all };
}

function readSubjectSelection(
  raw: Record<string, string | string[] | undefined>,
  legacySubject: string | undefined,
): SubjectSelection {
  const { ids, submitted, all } = parseSubjectParams(raw);

  if (!submitted || all) {
    return legacySubject ? new Set([legacySubject]) : null;
  }

  return new Set(legacySubject ? [...ids, legacySubject] : ids);
}

function matchesCourseSelection(
  assignment: { courseKey: string | null },
  selected: SubjectSelection,
): boolean {
  if (selected === null) {
    return true;
  }

  return assignment.courseKey !== null && selected.has(assignment.courseKey);
}

function buildCourseOptions(
  bars: readonly {
    courseKey: string | null;
    courseName: string | null;
    courseCode: string | null;
    className: string | null;
  }[],
  subjects: readonly {
    id: string;
    name: string;
    code: string | null;
    courseId: string | null;
    courseName: string | null;
    courseCode: string | null;
    classId: string;
  }[],
): CourseOption[] {
  const counts = new Map<string, number>();

  for (const bar of bars) {
    if (!bar.courseKey) {
      continue;
    }

    counts.set(bar.courseKey, (counts.get(bar.courseKey) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const options: Array<CourseOption & { sort: number }> = [];

  for (const bar of bars) {
    if (!bar.courseKey || seen.has(bar.courseKey)) {
      continue;
    }

    seen.add(bar.courseKey);
    options.push({
      key: bar.courseKey,
      name: bar.courseName ?? "Course",
      detail: joinDetail(bar.courseCode, bar.className),
      assignmentCount: counts.get(bar.courseKey) ?? 0,
      sort: 0,
    });
  }

  for (const subject of subjects) {
    const key = subject.courseId ?? subject.id;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push({
      key,
      name: subject.courseName ?? subject.name,
      detail: joinDetail(subject.courseCode ?? subject.code, null),
      assignmentCount: 0,
      sort: 1,
    });
  }

  return options
    .sort((left, right) => {
      if (left.sort !== right.sort) {
        return left.sort - right.sort;
      }

      return left.name.localeCompare(right.name);
    })
    .map(({ sort: _sort, ...option }) => option);
}

function joinDetail(
  code: string | null,
  className: string | null,
): string | null {
  if (code && className) {
    return `${code} · ${className}`;
  }

  return code ?? className;
}

function assignmentToItem(
  assignment: {
    id: string;
    title: string;
    startKey: string;
    endKey: string;
    href: string;
    courseKey: string | null;
    courseName: string | null;
    courseCode: string | null;
    isMine: boolean;
    isCompleted: boolean;
  },
  today: string,
): TimelineItem {
  return {
    id: `assignment:${assignment.id}`,
    kind: "assignment",
    title: assignment.title,
    startKey: assignment.startKey,
    endKey: assignment.endKey,
    deadlineKey: assignment.endKey,
    href: assignment.href,
    courseKey: assignment.courseKey ?? "unassigned",
    courseName: assignment.courseName,
    courseCode: assignment.courseCode,
    isMine: assignment.isMine,
    isCompleted: assignment.isCompleted,
    isOverdue: !assignment.isCompleted && assignment.endKey < today,
    assignmentId: assignment.id,
  };
}

function toTimelineItem(event: CalendarEvent): TimelineItem {
  const startKey = calendarEventDateKey(event.startsAt);
  const endKey = event.endsAt ? calendarEventDateKey(event.endsAt) : startKey;

  return {
    id: event.key,
    kind: event.eventType,
    title:
      event.status === "cancelled" ? `Cancelled: ${event.title}` : event.title,
    startKey: startKey || event.startsAt.slice(0, 10),
    endKey: endKey || startKey || event.startsAt.slice(0, 10),
    href: event.href,
    nativeEvent: event,
  };
}

function rawToParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "view") {
      continue;
    }

    const first = Array.isArray(value) ? value[0] : value;

    if (first) {
      params[key] = first;
    }
  }

  return params;
}

function TypeSelect({
  query,
  dateKey,
  subjectParams,
}: {
  query: CalendarQuery;
  dateKey: string;
  subjectParams: SubjectParams;
}) {
  const { ids, submitted, all } = subjectParams;

  return (
    <form
      method="get"
      action="/schedule"
      className="mt-1"
    >
      <input
        type="hidden"
        name="view"
        value={query.view}
      />
      <input
        type="hidden"
        name="date"
        value={dateKey}
      />
      {query.class ? (
        <input
          type="hidden"
          name="class"
          value={query.class}
        />
      ) : null}
      {query.mine === "mine" ? (
        <input
          type="hidden"
          name="mine"
          value="1"
        />
      ) : null}
      {submitted && all ? (
        <input
          type="hidden"
          name="all"
          value="1"
        />
      ) : submitted ? (
        <>
          {ids.map((id) => (
            <input
              key={id}
              type="hidden"
              name="subject"
              value={id}
            />
          ))}
          <input
            type="hidden"
            name="subjectsSet"
            value="1"
          />
        </>
      ) : null}
      <label className="text-muted-foreground block px-1 text-[11px] font-medium">
        Event type
        <select
          name="type"
          defaultValue={query.type}
          className="border-input bg-surface text-foreground focus-visible:outline-accent focus-visible:border-accent mt-1 block h-9 w-full rounded-md border px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <option value="all">All events</option>
          {Object.entries(CALENDAR_EVENT_TYPE_LABELS).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="text-accent hover:bg-accent-soft mt-2 w-full rounded-md px-2 py-1.5 text-xs font-medium"
      >
        Apply
      </button>
    </form>
  );
}

function Legend() {
  const items = [
    {
      swatch: <span className="h-3 w-10 rounded-sm bg-[#7fb0d8]" />,
      label: "Active period (from today to deadline)",
    },
    {
      swatch: (
        <span className="timeline-bar-past h-3 w-10 rounded-sm bg-[#7fb0d8]" />
      ),
      label: "Before today (already published)",
    },
    {
      swatch: <span className="h-3 w-10 rounded-sm bg-[#ececef]" />,
      label: "After deadline (past due)",
    },
    {
      swatch: <span className="h-3 w-10 rounded-sm bg-[#a7d3b8]" />,
      label: "Completed (your mark)",
    },
    {
      swatch: <span className="h-6 w-[2px] bg-[#0ea5e9]" />,
      label: "Today (Asia/Jakarta)",
    },
  ];

  return (
    <div className="border-border bg-surface rounded-2xl border p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground px-1">
        Legend
      </h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2.5 px-1 text-[11px] leading-tight text-muted-foreground"
          >
            <span className="flex w-10 shrink-0 items-center justify-center">
              {item.swatch}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function scheduleHref(
  query: CalendarQuery,
  anchorKey: string,
  overrides: { view?: CalendarView; date?: string },
  selected: SubjectSelection,
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

  if (query.mine === "mine") {
    params.set("mine", "1");
  }

  if (selected && selected.size > 0) {
    for (const id of selected) {
      params.append("subject", id);
    }

    params.set("subjectsSet", "1");
  } else if (selected && selected.size === 0) {
    params.set("subjectsSet", "1");
  }

  return `/schedule?${params.toString()}`;
}
