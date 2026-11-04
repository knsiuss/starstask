import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
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
 *
 * On the student's own page the search matches reference numbers; on the
 * reviewer queue it matches student nicknames (showSearch narrows the label).
 *
 * Desktop only: on mobile the panel pushed the request list far down the
 * screen, so it is not rendered there at all.
 */
export function LeaveFilters({
  action,
  values,
  searchPlaceholder = "Search requests...",
}: {
  action: string;
  values: { status?: string; from?: string; to?: string; q?: string };
  searchPlaceholder?: string;
}) {
  return (
    <form
      action={action}
      method="get"
      className="border-border bg-surface hidden rounded-2xl border p-3 sm:p-4 lg:block"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal
            aria-hidden="true"
            className="text-muted-foreground h-4 w-4"
          />
          Filters
        </p>
        <Link
          href={action}
          className="text-accent hover:text-accent-hover inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <RotateCcw
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Reset
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0 min-[380px]:col-span-2 lg:col-span-1">
          <Label htmlFor="q">Search</Label>
          <div className="relative mt-1">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input
              id="q"
              name="q"
              type="search"
              placeholder={searchPlaceholder}
              defaultValue={values.q ?? ""}
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-w-0 min-[380px]:col-span-2 lg:col-span-1">
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

        <div className="flex items-end min-[380px]:col-span-2 lg:col-span-1">
          <Button
            type="submit"
            className="w-full lg:w-auto"
          >
            Apply
          </Button>
        </div>
      </div>
    </form>
  );
}
