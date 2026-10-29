import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AssignmentFilters } from "@/components/assignments/assignment-filters";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  listAssignments,
  getCourseOptions,
  getSemesterOptions,
} from "@/lib/db/assignments";
import { getClassOptions } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { listAssignmentsQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Explore assignments",
  description:
    "Search and filter university assignments by course, semester, type, tag, and deadline.",
  alternates: { canonical: "/assignments" },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssignmentsPage({
  searchParams,
}: AssignmentsPageProps) {
  const rawParams = await searchParams;
  const parsed = listAssignmentsQuerySchema.safeParse(flattenParams(rawParams));

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
        <h1 className="text-3xl font-semibold tracking-tight">
          Explore assignments
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const query = parsed.data;
  const [result, courses, semesters, classes] = await Promise.all([
    listAssignments(query),
    getCourseOptions(),
    getSemesterOptions(),
    getClassOptions(),
  ]);

  const semesterOptions =
    query.semester && !semesters.includes(query.semester)
      ? [query.semester, ...semesters]
      : semesters;

  const hasActiveFilters = Boolean(
    query.search ||
    query.course ||
    query.class ||
    query.semester ||
    query.type ||
    query.tag ||
    query.sort !== "newest",
  );

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Explore assignments
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
          courses={courses}
          semesters={semesterOptions}
          classes={classes}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">Assignments</h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total} {result.total === 1 ? "result" : "results"}
          </span>
        </div>
        {hasActiveFilters ? (
          <Link
            href="/assignments"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <AssignmentList assignments={result.items} />
      </div>

      <Pagination
        basePath="/assignments"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          search: query.search,
          course: query.course,
          class: query.class,
          semester: query.semester,
          type: query.type,
          tag: query.tag,
          sort: query.sort,
          pageSize: String(query.pageSize),
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

    // A native select submits its empty "all" option as `?course=`. Dropping
    // blank values keeps those controls optional without a schema change.
    if (candidate) {
      flat[key] = candidate;
    }
  }

  return flat;
}
