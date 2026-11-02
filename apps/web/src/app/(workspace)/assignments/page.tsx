import type { Metadata } from "next";
import Link from "next/link";

import { AssignmentFilters } from "@/components/assignments/assignment-filters";
import { ExploreAssignmentRow } from "@/components/assignments/explore-assignment-row";
import { ExploreEmptyState } from "@/components/assignments/explore-empty-state";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buildAssignmentsHref } from "@/lib/assignments/urls";
import { requireAssignmentPageSession } from "@/lib/auth/assignment-access";
import { loadCompletionIds } from "@/lib/db/assignment-completions";
import { listAssignments } from "@/lib/db/assignments";
import { listMyClasses } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { formatCount, pluralize } from "@starstask/shared";
import { listAssignmentsQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Assignments",
  description:
    "Search university assignments shared by students, by title, course, or tag.",
  alternates: { canonical: "/assignments" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer =
  "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssignmentsPage({
  searchParams,
}: AssignmentsPageProps) {
  const rawParams = await searchParams;
  const flatParams = flattenParams(rawParams);
  const loginPath = buildAssignmentsHref(flatParams);
  const session = await requireAssignmentPageSession(loginPath);

  const parsed = listAssignmentsQuerySchema.safeParse(flatParams);

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/assignments"
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
        <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const query = parsed.data;
  const filterParams = {
    search: query.search,
    course: query.course,
    class: query.class,
    semester: query.semester,
    type: query.type,
    tag: query.tag,
    sort: query.sort,
    pageSize: String(query.pageSize),
  };

  const result = await listAssignments(query);
  const items = session
    ? await withCompletionMarks(session.user.id, result.items)
    : result.items;

  const hasActiveFilters = Boolean(
    query.search ||
    query.course ||
    query.class ||
    query.semester ||
    query.type ||
    query.tag ||
    query.sort !== "newest",
  );

  const resetHref = buildAssignmentsHref({});
  const nowIso = new Date().toISOString();
  const hasResults = items.length > 0;

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatCount(result.total)} {pluralize(result.total, "task")}
          </span>
        </div>
        <Button
          asChild
          variant="secondary"
          size="sm"
        >
          <Link href="/submit">Submit assignment</Link>
        </Button>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <AssignmentFilters query={query} />
        {hasActiveFilters ? (
          <Link
            href={resetHref}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Reset
          </Link>
        ) : null}
      </div>

      <div className="mt-5">
        {hasResults ? (
          <ul className="divide-border border-border divide-y border-y">
            {items.map((assignment) => (
              <ExploreAssignmentRow
                key={assignment.id}
                assignment={assignment}
                nowIso={nowIso}
              />
            ))}
          </ul>
        ) : (
          <ExploreEmptyState
            hasActiveFilters={hasActiveFilters}
            resetHref={resetHref}
          />
        )}
      </div>

      <Pagination
        basePath="/assignments"
        page={result.page}
        totalPages={result.totalPages}
        params={filterParams}
      />
    </div>
  );
}

function flattenParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const candidate =
      typeof value === "string"
        ? value
        : Array.isArray(value) && typeof value[0] === "string"
          ? value[0]
          : undefined;

    // Links can carry an empty value (for example `?tag=`); dropping those keeps
    // the schema treating them as absent.
    if (candidate) {
      flat[key] = candidate;
    }
  }

  return flat;
}

/**
 * Attaches the caller's own completion mark to listings of their classes.
 *
 * The public listing also shows assignments from classes the caller is not in;
 * marking those would always be refused by the database policy, so the toggle
 * is only rendered where `completed` is present.
 */
async function withCompletionMarks(
  userId: string,
  items: Awaited<ReturnType<typeof listAssignments>>["items"],
) {
  const memberships = await listMyClasses(userId);
  const classIds = new Set(
    memberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.id),
  );
  const markable = items.filter(
    (item) => item.class_id !== null && classIds.has(item.class_id),
  );

  if (markable.length === 0) {
    return items;
  }

  const completedIds = await loadCompletionIds(
    userId,
    markable.map((item) => item.id),
  );
  const markableIds = new Set(markable.map((item) => item.id));

  return items.map((item) =>
    markableIds.has(item.id)
      ? { ...item, completed: completedIds.has(item.id) }
      : item,
  );
}
