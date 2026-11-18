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
import { LecturerCoursesView } from "@/components/lecturer/lecturer-courses-view";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isLecturer } from "@/lib/auth/lecturer";
import { getSessionUser } from "@/lib/auth/session";
import { getLecturerBapProgress } from "@/lib/db/lecturer-bap";
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
  "mx-auto w-full max-w-5xl px-4 pt-5 pb-8 sm:px-6 sm:pt-7 lg:px-8 lg:py-10";

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
  const lecturer = rawParams.view !== "student" ? await isLecturer() : false;
  const lecturerMode =
    lecturer && rawParams.mode !== "classes" ? "courses" : "classes";
  const [classes, lecturerCourses] = await Promise.all([
    listMyClassDirectory(session.user.id),
    lecturer && lecturerMode === "courses"
      ? getLecturerBapProgress(session.user.id).catch(() => null)
      : Promise.resolve(null),
  ]);
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
      <header className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
            {lecturer ? "Classes you teach" : "My Classes"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {lecturer
              ? "Manage the classes you administer and teach on StarsTask."
              : "All your enrolled class groups in one place."}
          </p>
        </div>

        {/* The empty state carries its own primary action, so a header action
            here would be a second competing button. */}
        {classes.length > 0 ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-[44px] w-full sm:w-auto"
            >
              <Link href="/classes/create">Create class</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="min-h-[44px] w-full sm:w-auto"
            >
              <Link href="/classes/join">
                <PlusCircle
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Join a class
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      {lecturer && classes.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="bg-muted inline-flex rounded-lg p-1 text-xs font-medium">
            <Link
              href="/classes?mode=courses"
              className={
                lecturerMode === "courses"
                  ? "bg-background text-foreground rounded-md px-3 py-1.5 shadow-xs"
                  : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
              }
            >
              By course
            </Link>
            <Link
              href="/classes?mode=classes"
              className={
                lecturerMode === "classes" && query.status !== "archived"
                  ? "bg-background text-foreground rounded-md px-3 py-1.5 shadow-xs"
                  : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
              }
            >
              By class
            </Link>
            <Link
              href="/classes?mode=classes&status=archived"
              className={
                lecturerMode === "classes" && query.status === "archived"
                  ? "bg-background text-foreground rounded-md px-3 py-1.5 shadow-xs"
                  : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
              }
            >
              Archived
            </Link>
          </div>
          {lecturerMode === "courses" && lecturerCourses ? (
            <p className="text-muted-foreground text-sm">
              {formatCount(lecturerCourses.offerings.length)}{" "}
              {pluralize(lecturerCourses.offerings.length, "course")}
            </p>
          ) : null}
        </div>
      ) : null}

      {lecturerMode === "courses" && classes.length > 0 ? (
        lecturerCourses ? (
          <div className="mt-4">
            <LecturerCoursesView summary={lecturerCourses} />
          </div>
        ) : (
          <Alert
            variant="error"
            className="mt-5"
          >
            Could not load your course BAP overview. Try refreshing the page.
          </Alert>
        )
      ) : (
        <>
          {classes.length > 0 ? (
            // Filters are a desktop concern only: on mobile they eat the first
            // screen and push the cards down, so the panel is not rendered there
            // at all. The toolbar component itself stays untouched.
            <div className="mt-5 hidden lg:block">
              <ClassDirectoryToolbar
                query={query}
                semesters={semesters}
                academicYears={academicYears}
                hasFilters={hasFilters}
              />
            </div>
          ) : null}

          {classes.length > 0 ? (
            <div className="mt-4 flex items-center justify-between gap-3 lg:mt-5">
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
              <EmptyClassDirectory isLecturer={lecturer} />
            ) : visible.length === 0 ? (
              <EmptyClassSearch />
            ) : (
              <ClassDirectoryList
                classes={visible}
                view={query.view}
              />
            )}
          </div>
        </>
      )}
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
