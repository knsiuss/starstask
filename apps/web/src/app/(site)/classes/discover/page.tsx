import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ClassFilters } from "@/components/classes/class-filters";
import { ClassList } from "@/components/classes/class-card";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getClassSemesterOptions, listClasses } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { classDiscoveryQuerySchema } from "@starstask/contracts";

const DISCOVER_PATH = "/classes/discover";

export const metadata: Metadata = {
  title: "Browse classes",
  description:
    "Discover approved academic classes and the assignments their members have published.",
  alternates: { canonical: DISCOVER_PATH },
};

export const dynamic = "force-dynamic";

type ClassDiscoveryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassDiscoveryPage({
  searchParams,
}: ClassDiscoveryPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Classes</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const rawParams = await searchParams;
  const parsed = classDiscoveryQuerySchema.safeParse(
    flattenSearchParams(rawParams),
  );

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href={DISCOVER_PATH}
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
  const [result, semesters] = await Promise.all([
    listClasses(query),
    getClassSemesterOptions(),
  ]);

  const semesterOptions =
    query.semester && !semesters.includes(query.semester)
      ? [query.semester, ...semesters]
      : semesters;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Browse classes
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Approved classes group assignments under a course and a class admin
            who reviews every submission before it goes public.
          </p>
        </div>
        <Button
          asChild
          size="lg"
        >
          <Link href="/dashboard/applications">
            <PlusCircle
              aria-hidden="true"
              className="h-4 w-4"
            />
            Apply to create a class
          </Link>
        </Button>
      </header>

      <div className="mt-6">
        <ClassFilters
          query={query}
          semesters={semesterOptions}
          action={DISCOVER_PATH}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">Classes</h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total} {result.total === 1 ? "class" : "classes"}
          </span>
        </div>
        {query.search || query.semester ? (
          <Link
            href={DISCOVER_PATH}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <ClassList classes={result.items} />
      </div>

      <Pagination
        basePath={DISCOVER_PATH}
        page={result.page}
        totalPages={result.totalPages}
        params={{
          search: query.search,
          semester: query.semester,
          pageSize: String(query.pageSize),
        }}
      />
    </div>
  );
}
