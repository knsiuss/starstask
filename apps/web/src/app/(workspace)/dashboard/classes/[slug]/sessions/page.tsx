import { ArrowLeft, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { SessionCalendar } from "@/components/sessions/session-calendar";
import { SessionFilters } from "@/components/sessions/session-filters";
import { SessionList } from "@/components/sessions/session-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { listSessions } from "@/lib/db/sessions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import {
  currentMonth,
  flattenSearchParams,
  monthParamValue,
  parseMonthParam,
} from "@/lib/utils/search-params";
import { sessionListQuerySchema } from "@starstask/contracts";
import { sessionMonthWindow } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class sessions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const CALENDAR_PAGE_SIZE = 100;

type ClassSessionsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassSessionsPage({
  params,
  searchParams,
}: ClassSessionsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug } = await params;
  const viewer = await getSessionUser();

  if (!viewer) {
    redirect(buildLoginPath(`/dashboard/classes/${slug}/sessions`));
  }

  const classRecord = await getClassBySlug(slug);

  if (!classRecord) {
    notFound();
  }

  const role = await getClassRole(classRecord.id);

  // Membership is enforced again by RLS; this check only avoids rendering a
  // page the viewer has no rows for.
  if (!role.isMember) {
    notFound();
  }

  const flat = flattenSearchParams(await searchParams);
  const parsed = sessionListQuerySchema.safeParse(flat);
  const basePath = `/dashboard/classes/${slug}/sessions`;

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href={basePath}
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

  const query = parsed.data;
  const isCalendar = query.view === "calendar";
  const month = parseMonthParam(flat.month, currentMonth());

  const result = isCalendar
    ? await listSessions(
        {
          ...query,
          status: "all",
          page: 1,
          pageSize: CALENDAR_PAGE_SIZE,
          ...sessionMonthWindow(month.year, month.month),
        },
        { classId: classRecord.id },
      )
    : await listSessions(query, { classId: classRecord.id });

  const hasActiveFilters =
    Boolean(query.type) || (!isCalendar && query.status !== "upcoming");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/classes/${slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        {classRecord.name}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Discussion sessions
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {classRecord.name} · {classRecord.semester}
          </p>
        </div>
        {role.canManage ? (
          <Button
            asChild
            size="lg"
          >
            <Link href={`${basePath}/new`}>
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
          classes={[]}
          showClass={false}
          action={basePath}
        />
      </div>

      {isCalendar ? (
        <div className="mt-8">
          <SessionCalendar
            sessions={result.items}
            year={month.year}
            month={month.month}
            basePath={basePath}
            params={{ type: query.type, pageSize: String(query.pageSize) }}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Showing every session in {monthParamValue(month)}, including
            cancelled ones.{" "}
            <Link
              href={basePath}
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
                href={basePath}
                className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
              >
                Reset filters
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <SessionList
              sessions={result.items}
              showClass={false}
              emptyTitle={
                hasActiveFilters
                  ? "No sessions match these filters"
                  : "No sessions scheduled yet"
              }
              emptyDescription={
                role.canManage
                  ? "Schedule the first one and participants can RSVP straight away."
                  : "Your class admin will post sessions here."
              }
            />
          </div>

          <Pagination
            basePath={basePath}
            page={result.page}
            totalPages={result.totalPages}
            params={{
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
