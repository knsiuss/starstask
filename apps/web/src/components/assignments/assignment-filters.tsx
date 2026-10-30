import { Search, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAssignmentsHref,
  type AssignmentView,
} from "@/lib/assignments/urls";
import { cn } from "@/lib/utils/cn";
import type { ListAssignmentsQuery } from "@starstask/contracts";

type AssignmentFiltersProps = {
  query: ListAssignmentsQuery;
  view: AssignmentView;
};

/** Shared padding so the input lines up with the search icon. */
const controlClass = "h-10 pl-8 pr-2.5";

/**
 * Search box for the assignment list.
 *
 * Course, class, semester, type, tag, and sort are no longer shown, but their
 * query parameters still work: links from the landing page and the global search
 * arrive with them. The active ones ride along as hidden fields so searching
 * does not silently drop the link's filter.
 */
export function AssignmentFilters({ query, view }: AssignmentFiltersProps) {
  const carriedFilters = [
    { name: "course", value: query.course },
    { name: "class", value: query.class },
    { name: "semester", value: query.semester },
    { name: "type", value: query.type },
    { name: "tag", value: query.tag },
    { name: "sort", value: query.sort === "newest" ? undefined : query.sort },
  ];

  const clearSearchHref = buildAssignmentsHref({
    course: query.course,
    class: query.class,
    semester: query.semester,
    type: query.type,
    tag: query.tag,
    sort: query.sort,
    pageSize: String(query.pageSize),
  });

  return (
    <form
      method="get"
      action="/assignments"
      role="search"
      aria-label="Search assignments"
      className="border-border bg-surface rounded-xl border p-4 shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
          />
          <Label
            htmlFor="filter-search"
            className="sr-only"
          >
            Search
          </Label>
          <Input
            id="filter-search"
            name="search"
            type="search"
            defaultValue={query.search ?? ""}
            placeholder="Search by title, course, or tag..."
            maxLength={100}
            className={cn(
              controlClass,
              "pr-10 [&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          {query.search ? (
            <Link
              href={clearSearchHref}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground focus-visible:outline-accent absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <X
                aria-hidden="true"
                className="h-4 w-4"
              />
            </Link>
          ) : null}
        </div>
        <Button
          type="submit"
          className="h-10 px-5 sm:w-auto"
        >
          Search
        </Button>
      </div>

      {carriedFilters.map((filter) =>
        filter.value ? (
          <input
            key={filter.name}
            type="hidden"
            name={filter.name}
            value={filter.value}
          />
        ) : null,
      )}

      <input
        type="hidden"
        name="pageSize"
        value={query.pageSize}
      />
      {view === "grid" ? (
        <input
          type="hidden"
          name="view"
          value="grid"
        />
      ) : null}
    </form>
  );
}
