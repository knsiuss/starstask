import Link from "next/link";

import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import type { StudentAttendanceView } from "@/lib/db/attendance";
import type { AttendanceQuery } from "@starstask/contracts";

export const ATTENDANCE_HISTORY_PAGE_SIZE = 15;

function pageHref(query: AttendanceQuery, page: number): string {
  const params = new URLSearchParams();

  if (query.class) {
    params.set("class", query.class);
  }

  if (query.subject) {
    params.set("subject", query.subject);
  }

  if (query.year) {
    params.set("year", query.year);
  }

  if (query.semester) {
    params.set("semester", query.semester);
  }

  if (query.from) {
    params.set("from", query.from);
  }

  if (query.to) {
    params.set("to", query.to);
  }

  if (query.status !== "all") {
    params.set("status", query.status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();

  return search ? `/attendance?${search}` : "/attendance";
}

/** Filters, a paged history table, and the empty states around them. */
export function AttendanceHistorySection({
  view,
  query,
  hasActiveFilters,
  page,
}: {
  view: StudentAttendanceView;
  query: AttendanceQuery;
  hasActiveFilters: boolean;
  page: number;
}) {
  const total = view.entries.length;
  const totalPages = Math.max(
    1,
    Math.ceil(total / ATTENDANCE_HISTORY_PAGE_SIZE),
  );
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * ATTENDANCE_HISTORY_PAGE_SIZE;
  const entries = view.entries.slice(
    start,
    start + ATTENDANCE_HISTORY_PAGE_SIZE,
  );

  return (
    <section
      aria-labelledby="attendance-history"
      className="space-y-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h2
            id="attendance-history"
            className="text-lg font-semibold tracking-tight"
          >
            Attendance History
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {total} {total === 1 ? "session" : "sessions"}
          </span>
        </div>
        {hasActiveFilters ? (
          <Link
            href="/attendance"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      <AttendanceFilters
        query={query}
        options={view.options}
        hasActiveFilters={hasActiveFilters}
      />

      <AttendanceHistory entries={entries} />

      {totalPages > 1 ? (
        <nav
          aria-label="Attendance history pages"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {currentPage > 1 ? (
            <Link
              href={pageHref(query, currentPage - 1)}
              className="text-accent font-medium hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span className="text-muted-foreground">Previous</span>
          )}

          <span className="text-muted-foreground text-xs">
            Page {currentPage} of {totalPages}
          </span>

          {currentPage < totalPages ? (
            <Link
              href={pageHref(query, currentPage + 1)}
              className="text-accent font-medium hover:underline"
            >
              Next
            </Link>
          ) : (
            <span className="text-muted-foreground">Next</span>
          )}
        </nav>
      ) : null}
    </section>
  );
}
