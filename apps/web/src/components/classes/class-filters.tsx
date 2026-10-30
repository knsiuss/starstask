import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ClassDiscoveryQuery } from "@starstask/contracts";

type ClassFiltersProps = {
  query: ClassDiscoveryQuery;
  semesters: string[];
  /** Public discovery lives on its own route so `/classes` can stay personal. */
  action: string;
};

export function ClassFilters({ query, semesters, action }: ClassFiltersProps) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label="Filter classes"
      className="border-border bg-surface rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Label
            htmlFor="class-search"
            className="sr-only"
          >
            Search classes
          </Label>
          <Input
            id="class-search"
            name="search"
            type="search"
            defaultValue={query.search ?? ""}
            placeholder="Search classes, courses, or lecturers..."
            maxLength={100}
            className="h-11 pl-9"
          />
        </div>

        <div className="sm:w-52">
          <Label
            htmlFor="class-semester"
            className="sr-only"
          >
            Semester
          </Label>
          <Select
            id="class-semester"
            name="semester"
            defaultValue={query.semester ?? ""}
            className="h-11"
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

        <Button
          type="submit"
          className="h-11 px-6"
        >
          Search
        </Button>
      </div>

      <input
        type="hidden"
        name="pageSize"
        value={query.pageSize}
      />
    </form>
  );
}
