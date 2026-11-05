import { ArrowUpRight, FileText, Inbox } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Pagination } from "@/components/assignments/pagination";
import {
  type ClassTab,
  classTabHref,
} from "@/components/classes/class-workspace-tabs";
import { StatusBadge } from "@/components/classes/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { MyClassSubmission } from "@/lib/db/class-submissions";
import type { AssignmentListItem } from "@/types/database";
import type {
  AssignmentStatus,
  ClassSubjectWithTaskCount,
} from "@starstask/contracts";
import {
  APP_TIME_ZONE,
  APP_TIME_ZONE_LABEL,
  type DeadlineState,
  deadlineStateLabel,
  formatDate,
  formatSessionTime,
  getDeadlineState,
} from "@starstask/shared";
import { cn } from "@/lib/utils/cn";

/**
 * `list_assignments` filters on `a.status = 'published'` and does not project
 * the column, so every row of this listing is published by that contract.
 */
const LISTING_STATUS: AssignmentStatus = "published";

/** This view is the `?tab=` state named by the class workspace tab map. */
const ASSIGNMENTS_TAB: ClassTab = "assignments";

type ClassAssignmentsTabProps = {
  classSlug: string;
  canManage: boolean;
  assignments: AssignmentListItem[];
  page: number;
  totalPages: number;
  subjects: ClassSubjectWithTaskCount[];
  selectedSubjectId?: string;
  submissions: MyClassSubmission[];
};

/**
 * Published assignments for one class.
 *
 * Every row links to the public assignment page, so the table and the mobile
 * card list must stay in sync on the columns a student needs to triage work.
 */
export function ClassAssignmentsTab({
  classSlug,
  canManage,
  assignments,
  page,
  totalPages,
  subjects,
  selectedSubjectId,
  submissions,
}: ClassAssignmentsTabProps) {
  const base = `/app/classes/${classSlug}`;
  const selectedSubject = selectedSubjectId
    ? subjects.find((subject) => subject.id === selectedSubjectId)
    : undefined;

  return (
    <div className="mt-6">
      <section aria-labelledby="class-assignments">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2
              id="class-assignments"
              className="text-lg font-semibold tracking-tight"
            >
              Assignments
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Published work for this class.
            </p>
          </div>

          <form
            action={base}
            method="get"
            className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
          >
            <input
              type="hidden"
              name="tab"
              value={ASSIGNMENTS_TAB}
            />
            <label
              htmlFor="assignment-subject-filter"
              className="sr-only"
            >
              Filter assignments by subject
            </label>
            <Select
              id="assignment-subject-filter"
              name="subject"
              defaultValue={selectedSubjectId ?? ""}
              className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              variant="secondary"
            >
              Filter
            </Button>
            {selectedSubject ? (
              <Button
                asChild
                variant="ghost"
              >
                <Link href={classTabHref(classSlug, ASSIGNMENTS_TAB)}>
                  Clear
                </Link>
              </Button>
            ) : null}
          </form>
        </div>

        {assignments.length === 0 ? (
          <EmptyNotice
            icon={
              <FileText
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
            }
            title={
              selectedSubject
                ? `No assignments for ${selectedSubject.name} yet`
                : "No published assignments yet"
            }
            body={
              selectedSubject
                ? "Choose another subject, or wait for a class admin to approve new work."
                : "Approved work appears here and in assignment search."
            }
          />
        ) : (
          <>
            <div className="border-border bg-surface mt-4 hidden overflow-x-auto rounded-xl border md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Published assignments in this class
                </caption>
                <thead className="bg-subtle text-muted-foreground">
                  <tr className="text-left text-xs font-medium tracking-wide uppercase">
                    <th
                      scope="col"
                      className="w-[38%] px-4 py-2.5 font-medium"
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 font-medium"
                    >
                      Subject
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 font-medium whitespace-nowrap"
                    >
                      Published
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 font-medium whitespace-nowrap"
                    >
                      Deadline
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 font-medium"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium whitespace-nowrap"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {assignments.map((assignment) => (
                    <tr
                      key={assignment.id}
                      className="hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={`/assignments/${assignment.id}`}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {assignment.title}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 align-middle">
                        {courseLabel(assignment)}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 align-middle whitespace-nowrap">
                        {formatDate(assignment.created_at)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Deadline deadline={assignment.deadline} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={LISTING_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <Link
                          href={`/assignments/${assignment.id}`}
                          className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        >
                          Open
                          <ArrowUpRight
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-border border-border bg-surface mt-4 divide-y rounded-xl border md:hidden">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/assignments/${assignment.id}`}
                        className="text-sm font-medium hover:text-accent hover:underline"
                      >
                        {assignment.title}
                      </Link>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {courseLabel(assignment)}
                      </p>
                    </div>
                    <StatusBadge
                      status={LISTING_STATUS}
                      className="shrink-0"
                    />
                  </div>

                  <div className="border-border mt-3 flex items-end justify-between gap-3 border-t pt-3">
                    <div className="min-w-0">
                      <Deadline deadline={assignment.deadline} />
                      <p className="text-muted-foreground mt-1.5 text-xs">
                        Published {formatDate(assignment.created_at)}
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="secondary"
                      className="shrink-0"
                    >
                      <Link href={`/assignments/${assignment.id}`}>
                        Open
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pagination
          basePath={base}
          page={page}
          totalPages={totalPages}
          params={{ tab: ASSIGNMENTS_TAB, subject: selectedSubjectId }}
        />
      </section>

      <section
        aria-labelledby="my-submissions-heading"
        id="my-submissions"
        className="mt-8 scroll-mt-6"
      >
        <h2
          id="my-submissions-heading"
          className="text-lg font-semibold tracking-tight"
        >
          {canManage
            ? "My posts in this class"
            : "My submissions in this class"}
        </h2>

        {submissions.length === 0 ? (
          <EmptyNotice
            icon={
              <Inbox
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
            }
            title={canManage ? "No posts yet" : "No submissions yet"}
            body={
              canManage
                ? "Assignments you post appear here."
                : "Your submitted work will appear here."
            }
            className="mt-3"
          />
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-xl border">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{submission.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Revision {submission.revision} ·{" "}
                    {formatDate(submission.updated_at)}
                  </p>
                  {submission.status === "rejected" &&
                  submission.rejection_reason ? (
                    <p className="text-danger mt-1 text-xs">
                      {submission.rejection_reason}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={submission.status} />
                  {submission.status === "published" ? (
                    <Link
                      href={`/assignments/${submission.id}`}
                      className="text-accent text-xs font-medium hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                  {submission.status === "rejected" ? (
                    <Link
                      href={`${base}/submissions/${submission.id}/revise`}
                      className="text-accent text-xs font-medium hover:underline"
                    >
                      Revise
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const DEADLINE_TEXT_STYLES: Record<DeadlineState, string> = {
  none: "text-muted-foreground",
  upcoming: "text-foreground",
  due_today: "text-warning",
  overdue: "text-danger",
};

/** Deadline states that deserve their own label line under the date. */
const EMPHASIZED_DEADLINE_STATES: DeadlineState[] = ["due_today", "overdue"];

/** Deadline rendered as a compact date line plus a time line. */
function Deadline({ deadline }: { deadline: string | null }) {
  const state = getDeadlineState(deadline);

  if (!deadline || state === "none") {
    return (
      <span className="text-muted-foreground text-xs">
        {deadlineStateLabel("none")}
      </span>
    );
  }

  return (
    <div className="leading-tight">
      <p
        className={cn(
          "text-sm font-medium whitespace-nowrap",
          DEADLINE_TEXT_STYLES[state],
        )}
      >
        {formatDate(deadline)}
      </p>
      <p className="text-muted-foreground text-xs whitespace-nowrap">
        {formatSessionTime(deadline, APP_TIME_ZONE)} {APP_TIME_ZONE_LABEL}
      </p>
      {EMPHASIZED_DEADLINE_STATES.includes(state) ? (
        <p
          className={cn(
            "mt-0.5 text-xs font-medium whitespace-nowrap",
            DEADLINE_TEXT_STYLES[state],
          )}
        >
          {deadlineStateLabel(state)}
        </p>
      ) : null}
    </div>
  );
}

type EmptyNoticeProps = {
  icon: ReactNode;
  title: string;
  body: string;
  className?: string;
};

function EmptyNotice({ icon, title, body, className }: EmptyNoticeProps) {
  return (
    <div
      className={cn(
        "border-border bg-subtle mt-4 flex items-center gap-3 rounded-xl border border-dashed px-4 py-4",
        className,
      )}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{body}</p>
      </div>
    </div>
  );
}

function courseLabel(assignment: AssignmentListItem): string {
  return assignment.course_code
    ? `${assignment.course_code} · ${assignment.course_name}`
    : assignment.course_name;
}
