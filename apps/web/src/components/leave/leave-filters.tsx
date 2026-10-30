import Link from "next/link";

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
      className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="lg:col-span-1">
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

      <div>
        <Label htmlFor="from">Absence from</Label>
        <Input
          id="from"
          name="from"
          type="date"
          defaultValue={values.from ?? ""}
          className="mt-1"
        />
      </div>

      <div>
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
        <div>
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

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-ring h-10 rounded-md px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Apply
        </button>
        <Link
          href={action}
          className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
