import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { WeeklyScheduleBoard } from "@/components/schedule/weekly-schedule-board";
import { SessionCalendar } from "@/components/sessions/session-calendar";
import { SessionFilters } from "@/components/sessions/session-filters";
import { SessionList } from "@/components/sessions/session-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listMyWeeklySchedule } from "@/lib/db/class-schedule";
import {
  getManageableClassOptions,
  getSessionClassFilterOptions,
  listSessions,
} from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  currentMonth,
  flattenSearchParams,
  monthParamValue,
  parseMonthParam,
} from "@/lib/utils/search-params";
import { sessionListQuerySchema } from "@starstask/contracts";
import { sessionMonthWindow } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Discussion sessions",
  description:
    "Upcoming discussion sessions, tutorials, and review meetings for your classes.",
  alternates: { canonical: "/sessions" },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10";

/** The RPC caps a page at 100 rows, which is what a month grid needs. */
const CALENDAR_PAGE_SIZE = 100;

type SessionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SessionsPage({
  searchParams,
}: SessionsPageProps) {
  const flat = flattenSearchParams(await searchParams);
  const parsed = sessionListQuerySchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/sessions"
              className="underline"
            >
              Reset the filters
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <h1 className="text-3xl font-semibold tracking-tight">
          Discussion sessions
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const query = parsed.data;
  const isCalendar = query.view === "calendar";
  const viewer = await getSessionUser();

  // Filter options and the "schedule" action are both viewer-scoped, so an
  // anonymous visitor gets the public list without either control.
  const [classes, manageable, weeklySchedule] = viewer
    ? await Promise.all([
        getSessionClassFilterOptions(viewer.user.id),
        getManageableClassOptions(viewer.user.id),
        listMyWeeklySchedule(viewer.user.id),
      ])
    : [[], [], []];

  const month = parseMonthParam(flat.month, currentMonth());

  // A month grid draws everything that falls in the month, cancelled sessions
  // included, so it queries without the status filter and over the month window.
  const result = isCalendar
    ? await listSessions({
        ...query,
        status: "all",
        page: 1,
        pageSize: CALENDAR_PAGE_SIZE,
        ...sessionMonthWindow(month.year, month.month),
      })
    : await listSessions(query);

  const hasActiveFilters =
    Boolean(query.class || query.type) ||
    (!isCalendar && query.status !== "upcoming");

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Discussion sessions
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Tutorials, review meetings, and Q&amp;A run by your class admin.
            RSVP so the organiser knows who is coming.
          </p>
        </div>
        {manageable.length > 0 ? (
          <Button
            asChild
            size="lg"
          >
            <Link href="/sessions/new">
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              Schedule a session
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="mt-6">
        <SessionFilters
          query={query}
          classes={classes}
        />
      </div>

      {viewer ? (
        <section
          aria-labelledby="weekly-schedule"
          className="mt-8"
        >
          <h2
            id="weekly-schedule"
            className="text-lg font-semibold tracking-tight"
          >
            Weekly course schedule
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            The recurring class hours saved by your classes. Add or change them
            on a class page.
          </p>
          <div className="mt-4">
            <WeeklyScheduleBoard entries={weeklySchedule} />
          </div>
        </section>
      ) : null}

      {isCalendar ? (
        <div className="mt-8">
          <SessionCalendar
            sessions={result.items}
            year={month.year}
            month={month.month}
            basePath="/sessions"
            params={{
              class: query.class,
              type: query.type,
              pageSize: String(query.pageSize),
            }}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Showing every session in {monthParamValue(month)}, including
            cancelled ones.{" "}
            <Link
              href="/sessions"
              className="text-accent hover:underline"
            >
              Switch to the list view
            </Link>{" "}
            to filter by status.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight">Sessions</h2>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {result.total} {result.total === 1 ? "session" : "sessions"}
              </span>
            </div>
            {hasActiveFilters ? (
              <Link
                href="/sessions"
                className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
              >
                Reset filters
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <SessionList
              sessions={result.items}
              emptyTitle={
                hasActiveFilters
                  ? "No sessions match these filters"
                  : "No sessions scheduled yet"
              }
              emptyDescription={
                hasActiveFilters
                  ? "Try a different class, format, or status."
                  : "When your class admin schedules a session, it shows up here."
              }
            />
          </div>

          <Pagination
            basePath="/sessions"
            page={result.page}
            totalPages={result.totalPages}
            params={{
              class: query.class,
              type: query.type,
              status: query.status,
              pageSize: String(query.pageSize),
            }}
          />
        </>
      )}
    </div>
  );
}
