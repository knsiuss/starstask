import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  LEAVE_REQUEST_STATUSES,
  LEAVE_STATUS_LABELS,
} from "@starstask/contracts";

/**
 * Filter bar submitted as a GET form, so the filtered view is a real URL that
 * can be bookmarked, shared, and server-rendered without client state.
 */
export function LeaveFilters({
  action,
  values,
  showSearch = false,
}: {
  action: string;
  values: { status?: string; from?: string; to?: string; q?: string };
  showSearch?: boolean;
}) {
  return (
    <form
      action={action}
      method="get"
      className="border-border bg-card grid grid-cols-2 gap-3 rounded-xl border p-3 sm:p-4 lg:grid-cols-5"
    >
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          name="status"
          defaultValue={values.status ?? "all"}
          className="mt-1"
        >
          <option value="all">All statuses</option>
          {LEAVE_REQUEST_STATUSES.filter((status) => status !== "draft").map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {LEAVE_STATUS_LABELS[status]}
              </option>
            ),
          )}
        </Select>
      </div>

      <div className="min-w-0">
        <Label htmlFor="from">Absence from</Label>
        <Input
          id="from"
          name="from"
          type="date"
          defaultValue={values.from ?? ""}
          className="mt-1"
        />
      </div>

      <div className="min-w-0">
        <Label htmlFor="to">Absence to</Label>
        <Input
          id="to"
          name="to"
          type="date"
          defaultValue={values.to ?? ""}
          className="mt-1"
        />
      </div>

      {showSearch ? (
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <Label htmlFor="q">Student</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Nickname"
            defaultValue={values.q ?? ""}
            className="mt-1"
          />
        </div>
      ) : null}

      <div className="col-span-2 flex items-center gap-2 lg:col-span-1 lg:items-end lg:justify-end">
        <Button
          type="submit"
          className="flex-1 lg:flex-none"
        >
          Apply
        </Button>
        <Button
          asChild
          variant="secondary"
          className="flex-1 lg:flex-none"
        >
          <Link href={action}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}
