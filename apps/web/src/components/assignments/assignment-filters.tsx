import {
  ArrowDownUp,
  BookOpen,
  CalendarDays,
  FileText,
  Search,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CourseOption } from "@/lib/db/assignments";
import type { ClassOption } from "@/lib/db/classes";
import {
  ASSIGNMENT_TYPES,
  type ListAssignmentsQuery,
} from "@starstask/contracts";

type AssignmentFiltersProps = {
  query: ListAssignmentsQuery;
  courses: CourseOption[];
  semesters: string[];
  classes: ClassOption[];
};

/** Shared padding so every filter control lines up on the icon gutter. */
const controlClass = "h-11 pl-9";

export function AssignmentFilters({
  query,
  courses,
  semesters,
  classes,
}: AssignmentFiltersProps) {
  return (
    <form
      method="get"
      action="/assignments"
      role="search"
      aria-label="Filter assignments"
      className="border-border bg-surface rounded-xl border p-4 shadow-[0_1px_2px_rgba(23,33,29,0.04)] sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
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
            placeholder="Search assignments..."
            maxLength={100}
            className={controlClass}
          />
        </div>
        <Button
          type="submit"
          className="h-11 px-6 sm:w-auto"
        >
          Search
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5">
          <Label htmlFor="filter-course">Course</Label>
          <div className="relative">
            <BookOpen
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Select
              id="filter-course"
              name="course"
              defaultValue={query.course ?? ""}
              className={controlClass}
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option
                  key={course.id}
                  value={course.id}
                >
                  {course.code
                    ? `${course.code} · ${course.name}`
                    : course.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-class">Class</Label>
          <Select
            id="filter-class"
            name="class"
            defaultValue={query.class ?? ""}
            className="h-11"
          >
            <option value="">All classes</option>
            {classes.map((classItem) => (
              <option
                key={classItem.id}
                value={classItem.id}
              >
                {classItem.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-semester">Semester</Label>
          <div className="relative">
            <CalendarDays
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Select
              id="filter-semester"
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-type">Type</Label>
          <div className="relative">
            <FileText
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Select
              id="filter-type"
              name="type"
              defaultValue={query.type ?? ""}
              className={controlClass}
            >
              <option value="">All types</option>
              {ASSIGNMENT_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-tag">Tag</Label>
          <div className="relative">
            <Tag
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input
              id="filter-tag"
              name="tag"
              defaultValue={query.tag ?? ""}
              placeholder="e.g. database, pdf"
              maxLength={32}
              className={controlClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-sort">Sort by</Label>
          <div className="relative">
            <ArrowDownUp
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Select
              id="filter-sort"
              name="sort"
              defaultValue={query.sort}
              className={controlClass}
            >
              <option value="newest">Newest first</option>
              <option value="deadline">Deadline soonest</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
        </div>
      </div>

      <input
        type="hidden"
        name="pageSize"
        value={query.pageSize}
      />
    </form>
  );
}
