import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { OverviewSidebar } from "@/components/assignments/workspace/overview-sidebar";
import { RequestCard } from "@/components/assignments/workspace/request-card";
import { RequestPublicationDialog } from "@/components/assignments/workspace/request-publication-dialog";
import { ReviewRequestDialog } from "@/components/assignments/workspace/review-request-dialog";
import { ScheduleCard } from "@/components/assignments/workspace/schedule-card";
import { ScheduleFilterBar } from "@/components/assignments/workspace/schedule-filter-bar";
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
import { flattenSearchParams } from "@/lib/utils/search-params";
import { cn } from "@/lib/utils/cn";
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

export default async function AssignmentsPage({
  searchParams,
}: PageProps) {
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
  const pendingCount = managedRequests.filter(
    (item) => item.displayStatus === "pending",
  ).length;
  const requestsCount = manages
    ? pendingCount + myRequests.length
    : myRequests.length;

  const tabHref = (tab: "schedule" | "requests") =>
    tab === "schedule" ? BASE_PATH : `${BASE_PATH}?tab=requests`;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            {manages
              ? "Manage class tasks, schedules, and publication requests."
              : "Keep track of tasks and deadlines across your classes."}
          </p>
        </div>
        {scope.classes.length > 0 ? (
          <RequestPublicationDialog
            classes={scope.classes}
            mode={manages ? "create" : "request"}
          />
        ) : null}
      </header>

      <nav
        aria-label="Assignments sections"
        className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {(
          [
            { value: "schedule", label: "Task Schedule", count: schedule.total },
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
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground",
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

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
              <div className="mt-5">
                {schedule.items.length === 0 ? (
                  <EmptyState
                    title={
                      scope.classIds.length === 0
                        ? "No assignments yet."
                        : "No assignments match these filters."
                    }
                    description={
                      scope.classIds.length === 0
                        ? "Published class tasks will appear here."
                        : "Try a different search or filter to see the rest of your class tasks."
                    }
                    action={
                      scope.classIds.length === 0 ? (
                        <Link
                          href="/classes/join"
                          className="text-accent hover:text-accent-hover text-sm font-semibold"
                        >
                          Join a class
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

        <OverviewSidebar overview={overview} />
      </div>
    </div>
  );
}

function RequestsSection({
  manages,
  myRequests,
  managedRequests,
}: {
  manages: boolean;
  myRequests: Awaited<ReturnType<typeof listMyRequests>>;
  managedRequests: Awaited<ReturnType<typeof listManagedRequests>>;
}) {
  if (!manages) {
    if (myRequests.length === 0) {
      return (
        <EmptyState
          title="You haven't submitted any publication requests yet."
          description="Requests you send to a class admin will be tracked here."
        />
      );
    }

    return (
      <ul className="space-y-3">
        {myRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            mode="student"
          />
        ))}
      </ul>
    );
  }

  const toReview = managedRequests.filter(
    (item) => item.displayStatus === "pending",
  );
  const decided = managedRequests.filter(
    (item) => item.displayStatus !== "pending",
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="requests-to-review">
        <h2
          id="requests-to-review"
          className="text-foreground text-base font-semibold tracking-tight"
        >
          Requests to review
          <span className="bg-accent-soft text-accent ml-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
            {toReview.length}
          </span>
        </h2>
        <div className="mt-3">
          {toReview.length === 0 ? (
            <EmptyState
              title="No publication requests yet."
              description="Student requests will appear here when submitted."
            />
          ) : (
            <ul className="space-y-3">
              {toReview.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  mode="admin"
                  reviewAction={
                    <ReviewRequestDialog
                      assignmentId={request.id}
                      classSlug={request.class_slug}
                      title={request.title}
                    />
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {decided.length > 0 ? (
        <section aria-labelledby="requests-decided">
          <h2
            id="requests-decided"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Recently decided
          </h2>
          <ul className="mt-3 space-y-3">
            {decided.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mode="admin"
              />
            ))}
          </ul>
        </section>
      ) : null}

      {myRequests.length > 0 ? (
        <section aria-labelledby="requests-mine">
          <h2
            id="requests-mine"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            My requests
          </h2>
          <ul className="mt-3 space-y-3">
            {myRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mode="student"
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <h2 className="text-foreground text-base font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-md text-sm leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
