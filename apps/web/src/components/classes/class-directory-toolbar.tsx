import {
  ArrowDownUp,
  CalendarDays,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  ClassDirectoryQuery,
  ClassDirectoryView,
} from "@starstask/contracts";

type ClassDirectoryToolbarProps = {
  query: ClassDirectoryQuery;
  semesters: string[];
  /** Shows the reset link only when a control is actually narrowing the list. */
  hasFilters: boolean;
};

/** Toolbar padding so every control lines up on the icon gutter. */
const controlClass = "h-11 pl-9";

export function ClassDirectoryToolbar({
  query,
  semesters,
  hasFilters,
}: ClassDirectoryToolbarProps) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <form
        method="get"
        action="/classes"
        role="search"
        aria-label="Filter my classes"
        className="flex flex-col gap-3 md:flex-row md:items-center"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Label
            htmlFor="directory-search"
            className="sr-only"
          >
            Search classes
          </Label>
          <Input
            id="directory-search"
            name="search"
            type="search"
            defaultValue={query.search ?? ""}
            placeholder="Search classes..."
            maxLength={100}
            className={controlClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-center">
          <div className="relative sm:w-44">
            <CalendarDays
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Label
              htmlFor="directory-semester"
              className="sr-only"
            >
              Semester
            </Label>
            <Select
              id="directory-semester"
              name="semester"
              defaultValue={query.semester ?? ""}
              className={controlClass}
            >
              <option value="">All semesters</option>
              {semesters.map((semester) => (
                <option
                  key={semester}
                  value={semester}
                >
                  {semester}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative sm:w-48">
            <ArrowDownUp
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Label
              htmlFor="directory-sort"
              className="sr-only"
            >
              Sort by
            </Label>
            <Select
              id="directory-sort"
              name="sort"
              defaultValue={query.sort}
              className={controlClass}
            >
              <option value="newest">Newest joined</option>
              <option value="alphabetical">Alphabetical</option>
            </Select>
          </div>
        </div>

        <input
          type="hidden"
          name="view"
          value={query.view}
        />

        <Button
          type="submit"
          className="h-11 px-6"
        >
          Search
        </Button>
      </form>

      <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
        <ViewLink
          href={viewHref(query, "grid")}
          active={query.view === "grid"}
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
        >
          Grid
        </ViewLink>
        <ViewLink
          href={viewHref(query, "list")}
          active={query.view === "list"}
          icon={<List className="h-3.5 w-3.5" />}
        >
          List
        </ViewLink>

        {hasFilters ? (
          <Link
            href={`/classes?view=${query.view}`}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-accent ml-auto rounded-md px-2.5 py-1.5 text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Reset filters
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ViewLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
        active
          ? "bg-accent-soft text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function viewHref(
  query: ClassDirectoryQuery,
  view: ClassDirectoryView,
): string {
  const search = new URLSearchParams();

  if (query.search) {
    search.set("search", query.search);
  }

  if (query.semester) {
    search.set("semester", query.semester);
  }

  search.set("sort", query.sort);
  search.set("view", view);

  return `/classes?${search.toString()}`;
}
