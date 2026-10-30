import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { AssignmentFilters } from "@/components/assignments/assignment-filters";
import { ExploreAssignmentRow } from "@/components/assignments/explore-assignment-row";
import { ExploreEmptyState } from "@/components/assignments/explore-empty-state";
import { Pagination } from "@/components/assignments/pagination";
import { ResultViewToggle } from "@/components/assignments/result-view-toggle";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  buildAssignmentsHref,
  parseAssignmentView,
} from "@/lib/assignments/urls";
import { requireAssignmentPageSession } from "@/lib/auth/assignment-access";
import { listAssignments } from "@/lib/db/assignments";
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
  "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssignmentsPage({
  searchParams,
}: AssignmentsPageProps) {
  const rawParams = await searchParams;
  const view = parseAssignmentView(rawParams.view);
  const flatParams = flattenParams(rawParams);
  const loginPath = buildAssignmentsHref(flatParams, { view });
  await requireAssignmentPageSession(loginPath);

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
        <h1 className="text-3xl font-semibold tracking-tight">Assignments</h1>
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

  const hasActiveFilters = Boolean(
    query.search ||
    query.course ||
    query.class ||
    query.semester ||
    query.type ||
    query.tag ||
    query.sort !== "newest",
  );

  const resetHref = buildAssignmentsHref({ view });
  const listHref = buildAssignmentsHref(filterParams, { view: "list" });
  const gridHref = buildAssignmentsHref(filterParams, { view: "grid" });
  const nowIso = new Date().toISOString();
  const hasResults = result.items.length > 0;

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Assignments
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Browse university assignments shared by students.
          </p>
        </div>
        <Button
          asChild
          size="lg"
        >
          <Link href="/submit">
            <PlusCircle
              aria-hidden="true"
              className="h-4 w-4"
            />
            Submit assignment
          </Link>
        </Button>
      </header>

      <div className="mt-6">
        <AssignmentFilters
          query={query}
          view={view}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Results{" "}
          <span className="text-muted-foreground font-normal">
            ({formatCount(result.total)} {pluralize(result.total, "result")})
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {hasResults && hasActiveFilters ? (
            <Link
              href={resetHref}
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Reset filters
            </Link>
          ) : null}
          <ResultViewToggle
            current={view}
            listHref={listHref}
            gridHref={gridHref}
          />
        </div>
      </div>

      <div className="mt-4">
        {hasResults ? (
          view === "grid" ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((assignment) => (
                <li
                  key={assignment.id}
                  className="h-full"
                >
                  <AssignmentCard assignment={assignment} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
              <ul className="divide-border divide-y">
                {result.items.map((assignment) => (
                  <ExploreAssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    nowIso={nowIso}
                  />
                ))}
              </ul>
            </div>
          )
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
        params={{
          ...filterParams,
          view: view === "grid" ? "grid" : undefined,
        }}
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
