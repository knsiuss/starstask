import { ArrowLeft, ClipboardList, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AssignmentList } from "@/components/assignments/assignment-list";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listMemberPublishedAssignments } from "@/lib/db/dashboard";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { memberAssignmentsQuerySchema } from "@starstask/contracts";
import { formatCount, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class tasks",
  description: "Published assignments in the classes you belong to.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BASE_PATH = "/dashboard/assignments";

const DUE_FILTERS = [
  { value: undefined, label: "All tasks" },
  { value: "soon", label: "Due soon" },
  { value: "overdue", label: "Past deadline" },
] as const;

type DashboardAssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardAssignmentsPage({
  searchParams,
}: DashboardAssignmentsPageProps) {
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

  const rawParams = await searchParams;
  const parsed = memberAssignmentsQuerySchema.safeParse(
    flattenSearchParams(rawParams),
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
  const result = await listMemberPublishedAssignments(session.user.id, query);

  // A stale bookmark or hand-edited page number should land on real results
  // instead of an empty page with a misleading empty state.
  if (query.page > result.totalPages) {
    const target = new URLSearchParams();

    if (query.due) {
      target.set("due", query.due);
    }

    if (result.totalPages > 1) {
      target.set("page", String(result.totalPages));
    }

    const search = target.toString();
    redirect(search ? `${BASE_PATH}?${search}` : BASE_PATH);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Dashboard
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Class tasks</h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Every assignment published in the active classes you belong to.
            Archived classes are not included.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/classes">
            <GraduationCap
              aria-hidden="true"
              className="h-4 w-4"
            />
            My classes
          </Link>
        </Button>
      </header>

      <nav
        aria-label="Due date filters"
        className="mt-6 flex flex-wrap gap-2"
      >
        {DUE_FILTERS.map((filter) => {
          const href = filter.value
            ? `${BASE_PATH}?due=${filter.value}`
            : BASE_PATH;
          const isCurrent = query.due === filter.value;

          return (
            <Link
              key={filter.label}
              href={href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "focus-visible:outline-accent rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isCurrent
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex items-center gap-2.5">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ClipboardList
            aria-hidden="true"
            className="h-4 w-4"
          />
          Assignments
        </h2>
        <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
          {formatCount(result.total)} {pluralize(result.total, "task")}
        </span>
      </div>

      <div className="mt-4">
        {result.activeClassCount === 0 ? (
          <div className="border-border bg-subtle rounded-xl border border-dashed px-6 py-12 text-center">
            <GraduationCap
              aria-hidden="true"
              className="text-muted-foreground mx-auto h-6 w-6"
            />
            <h2 className="mt-3 text-base font-semibold">
              No active classes yet
            </h2>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              Join a class with an invitation link, then its published
              assignments will appear here.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/classes/join">Join a class</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
              >
                <Link href="/classes/discover">Browse classes</Link>
              </Button>
            </div>
          </div>
        ) : (
          <AssignmentList
            assignments={result.items}
            emptyTitle={
              query.due === "soon"
                ? "Nothing due in the next 7 days"
                : query.due === "overdue"
                  ? "No past deadlines"
                  : "No published assignments yet"
            }
            emptyDescription={
              query.due
                ? "Try another due date filter to see the rest of your class tasks."
                : "Once a class admin approves a submission, it appears here."
            }
          />
        )}
      </div>

      <Pagination
        basePath={BASE_PATH}
        page={result.page}
        totalPages={result.totalPages}
        params={{ due: query.due }}
      />
    </div>
  );
}
