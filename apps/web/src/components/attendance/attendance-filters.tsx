import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AttendanceFilterOptions } from "@/lib/db/attendance";
import {
  ATTENDANCE_FILTER_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceQuery,
} from "@starstask/contracts";

type AttendanceFiltersProps = {
  query: AttendanceQuery;
  options: AttendanceFilterOptions;
  hasActiveFilters: boolean;
  action?: string;
};

/** Plain GET form, so the filters work without client JavaScript. */
export function AttendanceFilters({
  query,
  options,
  hasActiveFilters,
  action = "/attendance",
}: AttendanceFiltersProps) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <form
        method="get"
        action={action}
        role="search"
        aria-label="Filter your attendance"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-class">Class</Label>
          <Select
            id="attendance-filter-class"
            name="class"
            defaultValue={query.class ?? ""}
          >
            <option value="">All my classes</option>
            {options.classes.map((classItem) => (
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
          <Label htmlFor="attendance-filter-subject">Course</Label>
          <Select
            id="attendance-filter-subject"
            name="subject"
            defaultValue={query.subject ?? ""}
          >
            <option value="">All courses</option>
            {options.subjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.code ? `${subject.code} · ` : ""}
                {subject.name} — {subject.className}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-year">Academic year</Label>
          <Select
            id="attendance-filter-year"
            name="year"
            defaultValue={query.year ?? ""}
          >
            <option value="">All years</option>
            {options.academicYears.map((year) => (
              <option
                key={year}
                value={year}
              >
                {year}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-semester">Semester</Label>
          <Select
            id="attendance-filter-semester"
            name="semester"
            defaultValue={query.semester ?? ""}
          >
            <option value="">All semesters</option>
            {options.semesters.map((semester) => (
              <option
                key={semester}
                value={semester}
              >
                {semester}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-from">From</Label>
          <Input
            id="attendance-filter-from"
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-to">To</Label>
          <Input
            id="attendance-filter-to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-filter-status">Status</Label>
          <Select
            id="attendance-filter-status"
            name="status"
            defaultValue={query.status}
          >
            {ATTENDANCE_FILTER_STATUSES.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status === "all"
                  ? "All statuses"
                  : ATTENDANCE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <Button
            type="submit"
            className="h-10"
          >
            Apply
          </Button>
          {hasActiveFilters ? (
            <Link
              href="/attendance?tab=history"
              className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
            >
              Reset
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
