"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { buildAssignmentsHref } from "@/lib/assignments/urls";
import {
  ASSIGNMENT_SORTS,
  ASSIGNMENT_TYPES,
  type ListAssignmentsQuery,
} from "@starstask/contracts";

type AssignmentFiltersProps = {
  query: ListAssignmentsQuery;
};

const SORT_LABELS: Record<(typeof ASSIGNMENT_SORTS)[number], string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  deadline: "Deadline",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The assignment toolbar: one search field, one type filter, one sort order.
 *
 * Every control writes to the URL and lets the server render the result, so a
 * filtered view is shareable and the back button restores the previous filters.
 * Changing a select re-submits the form immediately; the search field waits for
 * Enter because navigating on each keystroke would be noise.
 *
 * `course`, `class`, `semester`, and `tag` have no control here, but links from
 * the landing page and search still arrive with them. They ride along as hidden
 * fields so narrowing the list never silently drops an incoming filter.
 */
export function AssignmentFilters({ query }: AssignmentFiltersProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);

  const carriedFilters = [
    { name: "course", value: query.course },
    { name: "class", value: query.class },
    { name: "semester", value: query.semester },
    { name: "tag", value: query.tag },
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

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
      if (typeof value === "string" && value !== "") {
        params.set(key, value);
      }
    }

    const queryString = params.toString();

    // `page` is deliberately absent: any filter change returns to page 1.
    router.push(queryString ? `/assignments?${queryString}` : "/assignments");
  };

  return (
    <form
      // Remounting on a URL change keeps the uncontrolled inputs in sync when
      // the user navigates back or follows a link with different filters.
      key={`${query.search ?? ""}|${query.type ?? ""}|${query.sort}`}
      ref={formRef}
      method="get"
      action="/assignments"
      role="search"
      aria-label="Search and filter assignments"
      onSubmit={submit}
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
    >
      <div className="relative min-w-[13rem] flex-1 sm:max-w-sm">
        <Label
          htmlFor="filter-search"
          className="sr-only"
        >
          Search assignments
        </Label>
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        />
        <Input
          id="filter-search"
          name="search"
          type="search"
          defaultValue={query.search ?? ""}
          placeholder="Search assignments"
          maxLength={100}
          className="h-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query.search ? (
          <Link
            href={clearSearchHref}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground focus-visible:outline-accent absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <X
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        ) : null}
      </div>

      <div>
        <Label
          htmlFor="filter-type"
          className="sr-only"
        >
          Assignment type
        </Label>
        <Select
          id="filter-type"
          name="type"
          defaultValue={query.type ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="border-border bg-surface h-9 w-auto min-w-[8.5rem] py-0 text-[13px]"
        >
          <option value="">All types</option>
          {ASSIGNMENT_TYPES.map((type) => (
            <option
              key={type}
              value={type}
            >
              {capitalize(type)}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label
          htmlFor="filter-sort"
          className="sr-only"
        >
          Sort by
        </Label>
        <Select
          id="filter-sort"
          name="sort"
          defaultValue={query.sort}
          onChange={() => formRef.current?.requestSubmit()}
          className="border-border bg-surface h-9 w-auto min-w-[9rem] py-0 text-[13px]"
        >
          {ASSIGNMENT_SORTS.map((sort) => (
            <option
              key={sort}
              value={sort}
            >
              {SORT_LABELS[sort]}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="submit"
        className="sr-only"
      >
        Apply filters
      </button>

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
    </form>
  );
}
