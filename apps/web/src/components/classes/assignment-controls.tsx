"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import {
  COURSE_ASSIGNMENT_FILTERS,
  COURSE_ASSIGNMENT_FILTER_LABELS,
  COURSE_ASSIGNMENT_SORTS,
  COURSE_ASSIGNMENT_SORT_LABELS,
  type CourseAssignmentFilter,
  type CourseAssignmentSort,
} from "@/features/classes/course-assignment-filters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AssignmentControlsProps = {
  query: string;
  filter: CourseAssignmentFilter;
  sort: CourseAssignmentSort;
};

/**
 * Search + status + sort controls for the course Assignments page.
 *
 * Every change is written to the URL (`q`, `filter`, `sort`) so the list
 * stays shareable and server-rendered; the search input debounces so typing
 * does not navigate on each keystroke.
 */
export function AssignmentControls({
  query,
  filter,
  sort,
}: AssignmentControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(query);
  const committedRef = React.useRef(query);

  const updateParams = React.useCallback(
    (updates: { q?: string; filter?: string; sort?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, entry] of Object.entries(updates)) {
        if (!entry || entry === "all" || entry === "due-soonest") {
          params.delete(key);
        } else {
          params.set(key, entry);
        }
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  // Adopt the URL value when it changes from outside (back/forward, links).
  React.useEffect(() => {
    if (query !== committedRef.current) {
      committedRef.current = query;
      setValue(query);
    }
  }, [query]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== committedRef.current) {
        committedRef.current = value;
        updateParams({ q: value });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [updateParams, value]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search assignments</span>
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
        />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search assignments..."
          className="border-input bg-surface text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-accent h-10 w-full rounded-full border pr-9 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue("")}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-accent absolute top-1/2 right-3 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2"
          >
            <X
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </button>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Status: ${COURSE_ASSIGNMENT_FILTER_LABELS[filter]}`}
              className="border-input bg-surface text-foreground hover:bg-muted focus-visible:outline-accent inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Status:{" "}
              <span className="font-medium">
                {COURSE_ASSIGNMENT_FILTER_LABELS[filter]}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="text-muted-foreground h-3.5 w-3.5"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COURSE_ASSIGNMENT_FILTERS.map((entry) => (
              <DropdownMenuItem
                key={entry}
                onSelect={() => updateParams({ filter: entry })}
              >
                <span className="flex w-full items-center justify-between gap-6">
                  {COURSE_ASSIGNMENT_FILTER_LABELS[entry]}
                  {entry === filter ? (
                    <Check
                      aria-hidden="true"
                      className="text-accent h-4 w-4"
                    />
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Sort: ${COURSE_ASSIGNMENT_SORT_LABELS[sort]}`}
              className="border-input bg-surface text-foreground hover:bg-muted focus-visible:outline-accent inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Sort:{" "}
              <span className="font-medium">
                {COURSE_ASSIGNMENT_SORT_LABELS[sort]}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="text-muted-foreground h-3.5 w-3.5"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COURSE_ASSIGNMENT_SORTS.map((entry) => (
              <DropdownMenuItem
                key={entry}
                onSelect={() => updateParams({ sort: entry })}
              >
                <span className="flex w-full items-center justify-between gap-6">
                  {COURSE_ASSIGNMENT_SORT_LABELS[entry]}
                  {entry === sort ? (
                    <Check
                      aria-hidden="true"
                      className="text-accent h-4 w-4"
                    />
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
