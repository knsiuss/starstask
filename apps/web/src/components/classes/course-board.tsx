"use client";

import { BookOpen, LayoutGrid, List, Search } from "lucide-react";
import * as React from "react";

import { CourseManager } from "@/components/classes/course-manager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import type { ClassSubjectWithTaskCount } from "@starstask/contracts";

type Props = {
  classSlug: string;
  courses: ClassSubjectWithTaskCount[];
};

type StatusFilter = "all" | "active" | "archived";
type ViewMode = "grid" | "list";

/**
 * Courses toolbar and view switching. Search, status filter, and the
 * grid/list toggle all operate on the same server-provided course list, so
 * both views always render identical data.
 */
export function CourseBoard({ classSlug, courses }: Props) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [view, setView] = React.useState<ViewMode>("grid");

  const query = search.trim().toLowerCase();
  const filtered = courses.filter((course) => {
    if (status !== "all" && course.status !== status) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      course.name.toLowerCase().includes(query) ||
      (course.code?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1">
          <Label
            htmlFor="course-search"
            className="sr-only"
          >
            Search courses
          </Label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            id="course-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search courses…"
            className="pl-9"
          />
        </div>
        <div>
          <Label
            htmlFor="course-status-filter"
            className="sr-only"
          >
            Filter by status
          </Label>
          <Select
            id="course-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">Status: All</option>
            <option value="active">Status: Active</option>
            <option value="archived">Status: Archived</option>
          </Select>
        </div>
        <div
          role="group"
          aria-label="Course view"
          className="border-border bg-surface inline-flex overflow-hidden rounded-lg border"
        >
          <button
            type="button"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={cn(
              "focus-visible:outline-accent inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              view === "grid"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Grid
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={cn(
              "focus-visible:outline-accent inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              view === "list"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            List
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            courses.length === 0
              ? "No courses available."
              : status === "active"
                ? "No active courses."
                : status === "archived"
                  ? "No archived courses."
                  : "No search results."
          }
          description={
            courses.length === 0
              ? "Add the first course before posting assignments, attendance, or schedule entries."
              : status === "active"
                ? "Every course in this class is archived right now."
                : status === "archived"
                  ? "Nothing has been archived yet."
                  : "Try a different search or filter."
          }
        />
      ) : (
        <CourseManager
          classSlug={classSlug}
          courses={filtered}
          layout={view}
        />
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-border bg-surface mt-4 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-xl"
      >
        <BookOpen className="h-6 w-6" />
      </span>
      <h3 className="text-foreground mt-4 text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">
        {description}
      </p>
    </div>
  );
}
