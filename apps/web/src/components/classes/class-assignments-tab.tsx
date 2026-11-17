import { FileText, Inbox } from "lucide-react";
import Link from "next/link";

import { Pagination } from "@/components/assignments/pagination";
import {
  ClassAssignmentsList,
  ClassEmptyNotice,
} from "@/components/classes/class-assignments-list";
import {
  type ClassTab,
  classTabHref,
} from "@/components/classes/class-workspace-tabs";
import { StatusBadge } from "@/components/classes/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { MyClassSubmission } from "@/lib/db/class-submissions";
import type { AssignmentListItem } from "@/types/database";
import type { ClassSubjectWithTaskCount } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

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
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
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
              className="min-h-[44px] w-full sm:h-10 sm:min-h-0 sm:w-56"
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
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="secondary"
                className="min-h-[44px] flex-1 sm:min-h-0 sm:flex-none"
              >
                Filter
              </Button>
              {selectedSubject ? (
                <Button
                  asChild
                  variant="ghost"
                  className="min-h-[44px] sm:min-h-0"
                >
                  <Link href={classTabHref(classSlug, ASSIGNMENTS_TAB)}>
                    Clear
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {assignments.length === 0 ? (
          <ClassEmptyNotice
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
          <ClassAssignmentsList assignments={assignments} />
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
          <ClassEmptyNotice
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
          <ul className="divide-border border-border bg-surface mt-3 divide-y rounded-xl border">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{submission.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
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

                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={submission.status} />
                  {submission.status === "published" ? (
                    <Link
                      href={`/assignments/${submission.id}`}
                      className="text-accent focus-visible:outline-accent inline-flex min-h-[44px] items-center rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline sm:min-h-0"
                    >
                      View
                    </Link>
                  ) : null}
                  {submission.status === "rejected" ? (
                    <Link
                      href={`${base}/submissions/${submission.id}/revise`}
                      className="text-accent focus-visible:outline-accent inline-flex min-h-[44px] items-center rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 hover:underline sm:min-h-0"
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
