import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClassDirectoryList } from "@/components/classes/class-directory-list";
import {
  EmptyClassDirectory,
  EmptyClassSearch,
} from "@/components/classes/class-directory-empty";
import { ClassDirectoryToolbar } from "@/components/classes/class-directory-toolbar";
import { ClassDirectoryViewToggle } from "@/components/classes/class-directory-view-toggle";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  listMyClassDirectory,
  type ClassDirectoryItem,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import {
  classDirectoryQuerySchema,
  type ClassDirectoryQuery,
} from "@starstask/contracts";
import { formatCount, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "My Classes",
  description: "All your enrolled class groups in one place.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer =
  "mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10";

type MyClassesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MyClassesPage({
  searchParams,
}: MyClassesPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/classes"));
  }

  const rawParams = await searchParams;
  const parsed = classDirectoryQuerySchema.safeParse(
    flattenSearchParams(rawParams),
  );

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/classes"
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
  const classes = await listMyClassDirectory(session.user.id);
  const semesters = [
    ...new Set(classes.map((classItem) => classItem.semester)),
  ].sort((left, right) => left.localeCompare(right));
  const academicYears = [
    ...new Set(classes.map((classItem) => classItem.academic_year)),
  ].sort((left, right) => right.localeCompare(left));
  const visible = applyDirectoryQuery(classes, query);
  const hasFilters = Boolean(
    query.search ||
    query.semester ||
    query.academicYear ||
    query.status === "archived",
  );

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Classes</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            All your enrolled class groups in one place.
          </p>
        </div>

        {/* The empty state carries its own primary action, so a header action
            here would be a second competing button. */}
        {classes.length > 0 ? (
          <Button asChild>
            <Link href="/classes/join">
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              Join a class
            </Link>
          </Button>
        ) : null}
      </header>

      {classes.length > 0 ? (
        <div className="mt-6">
          <ClassDirectoryToolbar
            query={query}
            semesters={semesters}
            academicYears={academicYears}
            hasFilters={hasFilters}
          />
        </div>
      ) : null}

      {classes.length > 0 ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {formatCount(visible.length)}{" "}
            {pluralize(visible.length, "class group")}
            {hasFilters ? ` of ${formatCount(classes.length)}` : ""}
          </p>
          <ClassDirectoryViewToggle query={query} />
        </div>
      ) : null}

      <div className="mt-4">
        {classes.length === 0 ? (
          <EmptyClassDirectory />
        ) : visible.length === 0 ? (
          <EmptyClassSearch />
        ) : (
          <ClassDirectoryList
            classes={visible}
            view={query.view}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Search and sorting run in memory: the directory only ever holds the caller's
 * own memberships, which the query caps at 100 rows.
 */
function applyDirectoryQuery(
  classes: ClassDirectoryItem[],
  query: ClassDirectoryQuery,
): ClassDirectoryItem[] {
  const term = query.search?.toLocaleLowerCase() ?? null;

  const filtered = classes.filter((classItem) => {
    if (query.status === "archived") {
      if (classItem.status !== "archived") {
        return false;
      }
    } else if (classItem.status === "archived") {
      return false;
    }

    if (query.semester && classItem.semester !== query.semester) {
      return false;
    }

    if (query.academicYear && classItem.academic_year !== query.academicYear) {
      return false;
    }

    if (!term) {
      return true;
    }

    // The class code and the stable slug are what students actually quote to
    // each other, so both have to be searchable alongside the display name.
    return (
      classItem.name.toLocaleLowerCase().includes(term) ||
      classItem.course_name.toLocaleLowerCase().includes(term) ||
      classItem.slug.toLocaleLowerCase().includes(term) ||
      (classItem.class_code?.toLocaleLowerCase().includes(term) ?? false)
    );
  });

  if (query.sort === "alphabetical") {
    return filtered.sort((left, right) => left.name.localeCompare(right.name));
  }

  return filtered.sort((left, right) =>
    right.joined_at.localeCompare(left.joined_at),
  );
}
