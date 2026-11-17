import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { OverviewSidebar } from "@/components/assignments/workspace/overview-sidebar";
import { RequestPublicationDialog } from "@/components/assignments/workspace/request-publication-dialog";
import { RequestsSection } from "@/components/assignments/workspace/requests-section";
import { ScheduleCard } from "@/components/assignments/workspace/schedule-card";
import { ScheduleFilterBar } from "@/components/assignments/workspace/schedule-filter-bar";
import { WorkspaceEmptyState } from "@/components/assignments/workspace/workspace-empty-state";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import {
  getWorkspaceOverview,
  getWorkspaceScope,
  listManagedRequests,
  listMyRequests,
  listWorkspaceSchedule,
} from "@/lib/db/assignment-workspace";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { assignmentWorkspaceQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Assignments",
  description: "Class tasks, schedules, and publication requests.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BASE_PATH = "/assignments";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssignmentsPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(BASE_PATH));
  }

  const parsed = assignmentWorkspaceQuerySchema.safeParse(
    flattenSearchParams(await searchParams),
  );

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href={BASE_PATH}
              className="underline"
            >
              Reset the list
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const query = parsed.data;
  const scope = await getWorkspaceScope(session.user.id);

  const [schedule, overview, myRequests, managedRequests] = await Promise.all([
    listWorkspaceSchedule(scope, query),
    getWorkspaceOverview(scope),
    listMyRequests(session.user.id, scope),
    listManagedRequests(scope),
  ]);

  // A stale page number should land on real results, not an empty list.
  if (query.page > schedule.totalPages) {
    const target = new URLSearchParams({ tab: query.tab });

    if (query.search) {
      target.set("search", query.search);
    }

    if (query.class) {
      target.set("class", query.class);
    }

    if (query.status !== "all") {
      target.set("status", query.status);
    }

    if (query.sort !== "newest") {
      target.set("sort", query.sort);
    }

    if (schedule.totalPages > 1) {
      target.set("page", String(schedule.totalPages));
    }

    redirect(`${BASE_PATH}?${target.toString()}`);
  }

  const manages = scope.managesAnyClass;
  const pendingManaged = managedRequests.filter(
    (item) => item.displayStatus === "pending",
  );
  const pendingManagedIds = new Set(pendingManaged.map((item) => item.id));
  const pendingOwnCount = myRequests.filter(
    (item) =>
      item.status === "pending_review" &&
      (!manages || !pendingManagedIds.has(item.id)),
  ).length;
  const requestsCount = manages
    ? pendingManaged.length + pendingOwnCount
    : pendingOwnCount;
  const hasFilters = Boolean(
    query.search ||
    query.class ||
    query.status !== "all" ||
    query.sort !== "newest",
  );

  const tabHref = (tab: "schedule" | "requests") =>
    tab === "schedule" ? BASE_PATH : `${BASE_PATH}?tab=requests`;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-5 pb-24 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
            Assignments
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {manages
              ? "Manage class tasks, schedules, and publication requests."
              : "Keep track of tasks and deadlines across your classes."}
          </p>
        </div>
        {scope.classes.length > 0 ? (
          <div className="w-full shrink-0 sm:w-auto">
            <RequestPublicationDialog
              classes={scope.classes}
              mode={manages ? "create" : "request"}
            />
          </div>
        ) : null}
      </header>

      <div className="mt-5 lg:hidden">
        <OverviewSidebar
          overview={overview}
          idPrefix="workspace-overview-mobile"
        />
      </div>

      <nav
        aria-label="Assignments sections"
        className="no-scrollbar border-border mt-5 flex gap-1 overflow-x-auto border-b lg:mt-6"
      >
        {(
          [
            {
              value: "schedule",
              label: "Task Schedule",
              count: schedule.total,
            },
            {
              value: "requests",
              label: manages ? "Publication Requests" : "My Requests",
              count: requestsCount,
            },
          ] as const
        ).map((tab) => {
          const active = query.tab === tab.value;

          return (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "border-accent text-accent font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                  active
                    ? "bg-accent-soft text-accent"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 grid items-start gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {query.tab === "schedule" ? (
            <>
              <ScheduleFilterBar
                search={query.search}
                classId={query.class}
                status={query.status}
                sort={query.sort}
                classes={scope.classes}
                managesAnyClass={manages}
              />
              <div className="mt-4 sm:mt-5">
                {schedule.items.length === 0 ? (
                  <WorkspaceEmptyState
                    title={
                      scope.classIds.length === 0
                        ? "No assignments yet."
                        : "No assignments match these filters."
                    }
                    description={
                      scope.classIds.length === 0
                        ? "Published class tasks will appear here once you join a class."
                        : "Try a different search term or reset your active filters."
                    }
                    action={
                      scope.classIds.length === 0 ? (
                        <Link
                          href="/classes/join"
                          className="text-accent hover:text-accent-hover inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold"
                        >
                          Join a class
                        </Link>
                      ) : hasFilters ? (
                        <Link
                          href={BASE_PATH}
                          className="text-accent hover:text-accent-hover inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold"
                        >
                          Clear all filters
                        </Link>
                      ) : undefined
                    }
                  />
                ) : (
                  <ul className="space-y-3">
                    {schedule.items.map((item) => (
                      <ScheduleCard
                        key={item.id}
                        item={item}
                      />
                    ))}
                  </ul>
                )}
              </div>
              <Pagination
                basePath={BASE_PATH}
                page={schedule.page}
                totalPages={schedule.totalPages}
                params={{
                  tab: "schedule",
                  search: query.search,
                  class: query.class,
                  status: query.status === "all" ? undefined : query.status,
                  sort: query.sort === "newest" ? undefined : query.sort,
                }}
              />
            </>
          ) : (
            <RequestsSection
              manages={manages}
              myRequests={myRequests}
              managedRequests={managedRequests}
            />
          )}
        </div>

        <div className="hidden lg:block">
          <OverviewSidebar
            overview={overview}
            idPrefix="workspace-overview-desktop"
          />
        </div>
      </div>
    </div>
  );
}
