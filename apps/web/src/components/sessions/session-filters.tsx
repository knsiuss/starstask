import { CalendarDays, List, Video } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { SessionClassOption } from "@/lib/db/sessions";
import {
  SESSION_LIST_STATUSES,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  type SessionListQuery,
} from "@starstask/contracts";

const STATUS_LABELS: Record<(typeof SESSION_LIST_STATUSES)[number], string> = {
  upcoming: "Upcoming",
  all: "All sessions",
  scheduled: "Scheduled only",
  cancelled: "Cancelled",
  completed: "Completed",
};

type SessionFiltersProps = {
  query: SessionListQuery;
  classes: SessionClassOption[];
  /** Hides the class filter on a page already scoped to one class. */
  showClass?: boolean;
  action?: string;
};

/** Filter form. A plain GET submit, so it works without JavaScript. */
export function SessionFilters({
  query,
  classes,
  showClass = true,
  action = "/sessions",
}: SessionFiltersProps) {
  const isCalendar = query.view === "calendar";

  return (
    <div className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <form
        method="get"
        action={action}
        role="search"
        aria-label="Filter discussion sessions"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        {showClass ? (
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="session-filter-class">Class</Label>
            <Select
              id="session-filter-class"
              name="class"
              defaultValue={query.class ?? ""}
              className="h-11"
            >
              <option value="">All my classes</option>
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
        ) : null}

        <div className="space-y-1.5 sm:w-44">
          <Label htmlFor="session-filter-type">Format</Label>
          <Select
            id="session-filter-type"
            name="type"
            defaultValue={query.type ?? ""}
            className="h-11"
          >
            <option value="">Any format</option>
            {SESSION_TYPES.map((type) => (
              <option
                key={type}
                value={type}
              >
                {SESSION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        {/* The month grid always draws every session in the month, so the
            status filter would be a control that does nothing there. */}
        {isCalendar ? null : (
          <div className="space-y-1.5 sm:w-44">
            <Label htmlFor="session-filter-status">Status</Label>
            <Select
              id="session-filter-status"
              name="status"
              defaultValue={query.status}
              className="h-11"
            >
              {SESSION_LIST_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
        )}

        <input
          type="hidden"
          name="view"
          value={query.view}
        />
        <input
          type="hidden"
          name="pageSize"
          value={query.pageSize}
        />

        <Button
          type="submit"
          className="h-11 px-6"
        >
          Apply
        </Button>
      </form>

      <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
        <ViewLink
          href={viewHref(action, query, "list")}
          active={!isCalendar}
          icon={<List className="h-3.5 w-3.5" />}
        >
          List
        </ViewLink>
        <ViewLink
          href={viewHref(action, query, "calendar")}
          active={isCalendar}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
        >
          Calendar
        </ViewLink>
        <span className="text-muted-foreground ml-auto hidden items-center gap-1.5 text-xs sm:inline-flex">
          <Video
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Sessions you can see in your classes
        </span>
      </div>
    </div>
  );
}

function ViewLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
        active
          ? "bg-accent-soft text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function viewHref(
  action: string,
  query: SessionListQuery,
  view: "list" | "calendar",
): string {
  const search = new URLSearchParams();

  if (query.class) {
    search.set("class", query.class);
  }

  if (query.type) {
    search.set("type", query.type);
  }

  // The status filter only exists in list view, so the calendar link carries it
  // only when switching back, where it is restored from the current value.
  if (view === "list") {
    search.set("status", query.status);
  }

  search.set("view", view);
  search.set("pageSize", String(query.pageSize));

  return `${action}?${search.toString()}`;
}
