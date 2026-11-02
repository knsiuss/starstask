"use client";

import {
  Archive,
  ArrowDownUp,
  CalendarDays,
  CalendarRange,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ClassDirectoryQuery } from "@starstask/contracts";

type ClassDirectoryToolbarProps = {
  query: ClassDirectoryQuery;
  semesters: string[];
  academicYears: string[];
  /** Shows the reset link only when a control is actually narrowing the list. */
  hasFilters: boolean;
};

/**
 * Inline filters for My Classes.
 *
 * Every control writes to the URL and the server renders the result, so a
 * filtered view is shareable and the back button restores the previous state.
 * The selects re-submit immediately; the search field waits for Enter, because
 * navigating on each keystroke would reload the page mid-word.
 */
export function ClassDirectoryToolbar({
  query,
  semesters,
  academicYears,
  hasFilters,
}: ClassDirectoryToolbarProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);

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

    router.push(queryString ? `/classes?${queryString}` : "/classes");
  };

  return (
    <form
      // Remount on URL change so the uncontrolled inputs follow the filters
      // when the user navigates back or follows a filtered link.
      key={`${query.search ?? ""}|${query.semester ?? ""}|${query.academicYear ?? ""}|${query.status}|${query.sort}`}
      ref={formRef}
      method="get"
      action="/classes"
      role="search"
      aria-label="Search and filter my classes"
      onSubmit={submit}
      className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        />
        <Label
          htmlFor="directory-search"
          className="sr-only"
        >
          Search by class name or code
        </Label>
        <Input
          id="directory-search"
          name="search"
          type="search"
          defaultValue={query.search ?? ""}
          placeholder="Search your classes..."
          maxLength={100}
          className="h-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 min-w-0 sm:w-40">
          <Archive
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Label
            htmlFor="directory-status"
            className="sr-only"
          >
            Lifecycle
          </Label>
          <Select
            id="directory-status"
            name="status"
            defaultValue={query.status}
            onChange={() => formRef.current?.requestSubmit()}
            className="h-10 pl-9 text-sm"
          >
            <option value="active">Active classes</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        <div className="relative min-w-0 sm:w-36">
          <CalendarRange
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Label
            htmlFor="directory-year"
            className="sr-only"
          >
            Academic year
          </Label>
          <Select
            id="directory-year"
            name="academicYear"
            defaultValue={query.academicYear ?? ""}
            onChange={() => formRef.current?.requestSubmit()}
            className="h-10 pl-9 text-sm"
          >
            <option value="">All years</option>
            {academicYears.map((year) => (
              <option
                key={year}
                value={year}
              >
                {year}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative min-w-0 sm:w-44">
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
            onChange={() => formRef.current?.requestSubmit()}
            className="h-10 pl-9 text-sm"
          >
            <option value="">All semesters</option>
            {semesters.map((semester) => (
              <option
                key={semester}
                value={semester}
              >
                Semester {semester}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative col-span-2 min-w-0 sm:w-48">
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
            onChange={() => formRef.current?.requestSubmit()}
            className="h-10 pl-9 text-sm"
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

      <button
        type="submit"
        className="sr-only"
      >
        Apply filters
      </button>

      {hasFilters ? (
        <Link
          href={`/classes?view=${query.view}`}
          className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-4 hover:underline sm:self-auto"
        >
          Reset
        </Link>
      ) : null}
    </form>
  );
}
