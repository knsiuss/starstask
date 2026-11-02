import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { Pagination } from "@/components/assignments/pagination";
import { StatusBadge } from "@/components/classes/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { MyClassSubmission } from "@/lib/db/class-submissions";
import type { AssignmentListItem } from "@/types/database";
import type { ClassSubjectWithTaskCount } from "@starstask/contracts";
import { formatDate, getDeadlineState } from "@starstask/shared";

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
  const base = `/dashboard/classes/${classSlug}`;
  const selectedSubject = selectedSubjectId
    ? subjects.find((subject) => subject.id === selectedSubjectId)
    : undefined;

  return (
    <div className="mt-6">
      <section aria-labelledby="class-assignments">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="class-assignments"
              className="text-lg font-semibold tracking-tight"
            >
              Assignments
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Work that passed review and is visible to every signed-in member.
              {selectedSubject ? ` Filtered by ${selectedSubject.name}.` : ""}
            </p>
          </div>

          <form
            action={base}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="hidden"
              name="tab"
              value="assignments"
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
              className="w-full sm:w-56"
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
              size="sm"
              variant="secondary"
            >
              Filter
            </Button>
            {selectedSubject ? (
              <Button
                asChild
                size="sm"
                variant="ghost"
              >
                <Link href={`${base}?tab=assignments`}>Clear</Link>
              </Button>
            ) : null}
          </form>
        </div>

        {assignments.length === 0 ? (
          <div className="border-border bg-surface mt-4 rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">
              {selectedSubject
                ? `No assignments for ${selectedSubject.name} yet`
                : "No published assignments yet"}
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
              {selectedSubject
                ? "Choose another subject, or wait for a class admin to approve new work."
                : "Once a class admin approves a submission, it appears here and in assignment search."}
            </p>
          </div>
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
                      className="px-4 py-2.5"
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5"
                    >
                      Subject
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5"
                    >
                      Published
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5"
                    >
                      Deadline
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right"
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
                      <td className="max-w-xs px-4 py-3">
                        <Link
                          href={`/assignments/${assignment.id}`}
                          className="hover:text-accent font-medium hover:underline"
                        >
                          {assignment.title}
                        </Link>
                      </td>
                      <td className="text-muted-foreground max-w-64 px-4 py-3">
                        {courseLabel(assignment)}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                        {formatDate(assignment.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <DeadlineBadge deadline={assignment.deadline} />
                      </td>
                      <td className="px-4 py-3">
                        <AssignmentStatus deadline={assignment.deadline} />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="hover:text-accent text-sm font-medium hover:underline"
                  >
                    {assignment.title}
                  </Link>
                  <div className="mt-2">
                    <DeadlineBadge deadline={assignment.deadline} />
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    {courseLabel(assignment)} · published{" "}
                    {formatDate(assignment.created_at)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <AssignmentStatus deadline={assignment.deadline} />
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
          params={{ tab: "assignments", subject: selectedSubjectId }}
        />
      </section>

      <section
        aria-labelledby="my-submissions-heading"
        className="scroll-mt-6"
        id="my-submissions"
      >
        <h2
          id="my-submissions-heading"
          className="mt-10 text-lg font-semibold tracking-tight"
        >
          {canManage
            ? "My posts in this class"
            : "My submissions in this class"}
        </h2>

        {submissions.length === 0 ? (
          <div className="border-border bg-subtle mt-3 rounded-lg border border-dashed px-5 py-8 text-center">
            <p className="text-sm font-medium">Nothing here yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
              {canManage
                ? "Post an assignment and it publishes immediately, with an alert to members who enabled notifications."
                : "Submit an assignment and a class admin will review it. Approved submissions are visible to signed-in students."}
            </p>
          </div>
        ) : (
          <ul className="border-border divide-border mt-3 divide-y rounded-lg border">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{submission.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Revision {submission.revision} · updated{" "}
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

function AssignmentStatus({ deadline }: { deadline: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusBadge status="published" />
      {getDeadlineState(deadline) === "overdue" ? (
        <Badge variant="danger">Overdue</Badge>
      ) : null}
    </span>
  );
}

function courseLabel(assignment: AssignmentListItem): string {
  return assignment.course_code
    ? `${assignment.course_code} · ${assignment.course_name}`
    : assignment.course_name;
}
