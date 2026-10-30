import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ADMIN_SEARCH_MAX,
  CLASS_APPLICATION_STATUSES,
  type ClassApplicationStatus,
} from "@starstask/contracts";

const STATUS_LABELS: Record<ClassApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

type AdminApplicationFiltersProps = {
  values: {
    search?: string;
    status: ClassApplicationStatus | "all";
  };
};

export function AdminApplicationFilters({
  values,
}: AdminApplicationFiltersProps) {
  return (
    <form
      action="/admin/applications"
      method="get"
      role="search"
      className="border-border bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-12"
    >
      <div className="lg:col-span-6">
        <Label htmlFor="admin-application-search">Search</Label>
        <Input
          id="admin-application-search"
          name="search"
          type="search"
          placeholder="Proposed class name"
          maxLength={ADMIN_SEARCH_MAX}
          defaultValue={values.search ?? ""}
          className="mt-1"
        />
      </div>

      <div className="lg:col-span-3">
        <Label htmlFor="admin-application-status">Status</Label>
        <Select
          id="admin-application-status"
          name="status"
          defaultValue={values.status}
          className="mt-1"
        >
          <option value="all">All statuses</option>
          {CLASS_APPLICATION_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2 lg:col-span-3">
        <Button
          type="submit"
          className="h-10"
        >
          Apply
        </Button>
        <Link
          href="/admin/applications"
          className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
