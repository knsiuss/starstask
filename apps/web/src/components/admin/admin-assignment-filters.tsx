import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ADMIN_ASSIGNMENT_STATUSES,
  ADMIN_ASSIGNMENT_STATUS_LABELS,
  ADMIN_SEARCH_MAX,
  type AdminAssignmentStatus,
} from "@starstask/contracts";

type AdminAssignmentFiltersProps = {
  values: {
    search?: string;
    status: AdminAssignmentStatus | "all";
    classId?: string;
  };
  classes: { id: string; name: string }[];
};

export function AdminAssignmentFilters({
  values,
  classes,
}: AdminAssignmentFiltersProps) {
  return (
    <form
      action="/admin/assignments"
      method="get"
      role="search"
      className="border-border bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-12"
    >
      <div className="lg:col-span-4">
        <Label htmlFor="admin-assignment-search">Search</Label>
        <Input
          id="admin-assignment-search"
          name="search"
          type="search"
          placeholder="Assignment title"
          maxLength={ADMIN_SEARCH_MAX}
          defaultValue={values.search ?? ""}
          className="mt-1"
        />
      </div>

      <div className="lg:col-span-3">
        <Label htmlFor="admin-assignment-status">Status</Label>
        <Select
          id="admin-assignment-status"
          name="status"
          defaultValue={values.status}
          className="mt-1"
        >
          <option value="all">All statuses</option>
          {ADMIN_ASSIGNMENT_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {ADMIN_ASSIGNMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="lg:col-span-3">
        <Label htmlFor="admin-assignment-class">Class</Label>
        <Select
          id="admin-assignment-class"
          name="class"
          defaultValue={values.classId ?? ""}
          className="mt-1"
        >
          <option value="">All classes</option>
          {classes.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.name}
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
          href="/admin/assignments"
          className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
