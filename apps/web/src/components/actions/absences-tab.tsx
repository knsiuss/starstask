import Link from "next/link";
import { CalendarDays, FileText, Paperclip } from "lucide-react";

import { LeaveStatusBadge } from "@/components/leave/leave-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LEAVE_REASON_LABELS } from "@starstask/contracts";
import {
  formatLeaveDate,
  formatLeaveDateRange,
  leaveDayCount,
} from "@starstask/shared";

import type { LeaveRequestSummary } from "@/lib/db/leave";

type Filters = {
  q?: string;
  class?: string;
  course?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
};

type ClassOption = { id: string; name: string; code: string | null };
type CourseOption = { id: string; name: string; code: string | null };

/** Filter bar for the absence tab. GET form so filtered views are shareable. */
export function AbsenceFilterBar({
  action,
  values,
  classes,
  courses,
}: {
  action: string;
  values: Filters;
  classes: ClassOption[];
  courses: CourseOption[];
}) {
  return (
    <form
      action={action}
      method="get"
      className="border-border bg-surface grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
    >
      <input
        type="hidden"
        name="tab"
        value="absences"
      />
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="absence-q">Search</Label>
        <Input
          id="absence-q"
          name="q"
          type="search"
          defaultValue={values.q ?? ""}
          placeholder="Student name…"
          className="mt-1"
        />
      </div>
      <div className="min-w-0">
        <Label htmlFor="absence-class">Class</Label>
        <Select
          id="absence-class"
          name="class"
          defaultValue={values.class ?? "all"}
          className="mt-1"
        >
          <option value="all">All classes</option>
          {classes.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.code ? `${item.code} · ${item.name}` : item.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-0">
        <Label htmlFor="absence-course">Course</Label>
        <Select
          id="absence-course"
          name="course"
          defaultValue={values.course ?? "all"}
          disabled={courses.length === 0}
          className="mt-1"
        >
          <option value="all">
            {courses.length === 0 ? "Pick a class first" : "All courses"}
          </option>
          {courses.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.code ? `${item.code} · ${item.name}` : item.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-0">
        <Label htmlFor="absence-status">Status</Label>
        <Select
          id="absence-status"
          name="status"
          defaultValue={values.status ?? "all"}
          className="mt-1"
        >
          <option value="all">All statuses</option>
          <option value="submitted">Pending</option>
          <option value="revision_requested">Revision Requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="forwarded">Forwarded</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <Button
        type="submit"
        variant="secondary"
        className="h-10 w-full sm:col-span-2 lg:col-span-1 lg:w-auto"
      >
        Filter
      </Button>
    </form>
  );
}

/**
 * One absence request in the admin queue.
 *
 * Desktop renders a structured list row (student, class, period, courses,
 * status); on narrow screens the same data stacks as cards. The whole card
 * links to the detail view; the review actions live on the detail view, not on
 * the list, so a list row never decides by accident.
 */
export function AbsenceRequestCard({
  request,
}: {
  request: LeaveRequestSummary;
}) {
  const dates =
    request.leaveStartDate && request.leaveEndDate
      ? formatLeaveDateRange(request.leaveStartDate, request.leaveEndDate)
      : "Dates not set yet";

  const days =
    request.leaveStartDate && request.leaveEndDate
      ? leaveDayCount(request.leaveStartDate, request.leaveEndDate)
      : 0;

  const courseRecap =
    request.subjectNames.length === 0
      ? "Whole class"
      : request.subjectNames.length <= 2
        ? request.subjectNames.join(", ")
        : `${request.subjectNames.slice(0, 2).join(", ")} +${request.subjectNames.length - 2} more`;

  return (
    <Link
      href={`/actions?tab=absences&request=${request.id}`}
      className="border-border bg-surface hover:border-accent/60 block rounded-xl border px-4 py-3.5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LeaveStatusBadge status={request.status} />
            <span className="text-muted-foreground font-mono text-[11px] tracking-wide">
              {request.reference}
            </span>
          </div>
          <h3 className="text-foreground mt-1.5 text-[15px] font-semibold tracking-tight">
            {request.studentName}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {request.className}
            {request.reasonCategory
              ? ` · ${LEAVE_REASON_LABELS[request.reasonCategory]}`
              : ""}
          </p>
        </div>
        {request.submittedAt ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap">
            <FileText
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Submitted {formatLeaveDate(request.submittedAt.slice(0, 10))}
          </p>
        ) : null}
      </div>

      <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <div className="flex items-center gap-1.5">
          <CalendarDays
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <dt className="sr-only">Absence period</dt>
          <dd>
            {dates}
            {days > 0 ? ` · ${days} ${days === 1 ? "day" : "days"}` : ""}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Affected courses</dt>
          <dd className="truncate">{courseRecap}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Paperclip
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <dt className="sr-only">Attachments</dt>
          <dd>
            {request.evidenceCount === 0
              ? "No attachment"
              : `${request.evidenceCount} file${request.evidenceCount === 1 ? "" : "s"}`}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export function AbsenceEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="border-border bg-subtle rounded-xl border border-dashed px-6 py-10 text-center">
      <p className="text-sm font-medium">
        {filtered
          ? "No requests match these filters"
          : "No absence requests yet"}
      </p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
        {filtered
          ? "Try a different search or filter combination."
          : "When students in the classes you lead submit absence requests, they appear here for review."}
      </p>
    </div>
  );
}
