import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ADMIN_SEARCH_MAX,
  CLASS_LIFECYCLE_STATUSES,
  type ClassLifecycleStatus,
} from "@starstask/contracts";

const STATUS_LABELS: Record<ClassLifecycleStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

type AdminClassFiltersProps = {
  values: {
    search?: string;
    status: ClassLifecycleStatus | "all";
    academicYear?: string;
    semester?: string;
  };
};

export function AdminClassFilters({ values }: AdminClassFiltersProps) {
  return (
    <form
      action="/admin/classes"
      method="get"
      role="search"
      className="border-border bg-surface hidden gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid lg:grid-cols-12"
    >
      <div className="lg:col-span-4">
        <Label htmlFor="admin-class-search">Search</Label>
        <Input
          id="admin-class-search"
          name="search"
          type="search"
          placeholder="Class name, code, course, slug, or institution"
          maxLength={ADMIN_SEARCH_MAX}
          defaultValue={values.search ?? ""}
          className="mt-1"
        />
      </div>

      <div className="lg:col-span-2">
        <Label htmlFor="admin-class-year">Academic year</Label>
        <Input
          id="admin-class-year"
          name="academicYear"
          placeholder="2025/2026"
          maxLength={20}
          defaultValue={values.academicYear ?? ""}
          className="mt-1"
        />
      </div>

      <div className="lg:col-span-2">
        <Label htmlFor="admin-class-semester">Semester</Label>
        <Input
          id="admin-class-semester"
          name="semester"
          placeholder="e.g. 1"
          maxLength={20}
          defaultValue={values.semester ?? ""}
          className="mt-1"
        />
      </div>

      <div className="lg:col-span-2">
        <Label htmlFor="admin-class-status">Status</Label>
        <Select
          id="admin-class-status"
          name="status"
          defaultValue={values.status}
          className="mt-1"
        >
          <option value="all">All statuses</option>
          {CLASS_LIFECYCLE_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2 lg:col-span-2">
        <Button
          type="submit"
          className="h-10"
        >
          Apply
        </Button>
        <Link
          href="/admin/classes"
          className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
