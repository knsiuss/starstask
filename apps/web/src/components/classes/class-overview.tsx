import { ArrowRight, ClipboardList, Users } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { StatusBadge } from "@/components/classes/status-badge";
import type { ClassMemberView, ClassSummary } from "@/lib/db/classes";
import type { MyClassSubmission } from "@/lib/db/class-submissions";
import type { AssignmentListItem } from "@/types/database";
import type { ClassSubjectWithTaskCount } from "@starstask/contracts";
import { formatDate, pluralize } from "@starstask/shared";

type ClassOverviewProps = {
  classSummary: ClassSummary;
  recentAssignments: AssignmentListItem[];
  submissions: MyClassSubmission[];
  subjects: ClassSubjectWithTaskCount[];
  members: ClassMemberView[];
  canManage: boolean;
  isActive: boolean;
};

export function ClassOverview({
  classSummary,
  recentAssignments,
  submissions,
  subjects,
  members,
  canManage,
  isActive,
}: ClassOverviewProps) {
  const base = `/dashboard/classes/${classSummary.slug}`;
  const adminCount = members.filter((member) => member.is_admin).length;
  const courses = subjects.filter((subject) => subject.id !== classSummary.id);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section
          aria-labelledby="recent-assignments"
          className="border-border bg-surface overflow-hidden rounded-xl border"
        >
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <div>
              <h2
                id="recent-assignments"
                className="text-base font-semibold tracking-tight"
              >
                Recent assignments
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                The latest work published by this class.
              </p>
            </div>
            <Link
              href={`${base}?tab=assignments`}
              className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View all
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          </div>

          {recentAssignments.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium">Nothing published yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                {isActive
                  ? canManage
                    ? "Post an assignment and it publishes immediately for every member."
                    : "Submit an assignment and a class admin will review it before it becomes public."
                  : "This class is archived, so no new work can be published."}
              </p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {recentAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/assignments/${assignment.id}`}
                      className="hover:text-accent text-sm font-medium hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {assignment.course_code
                        ? `${assignment.course_code} · `
                        : ""}
                      {assignment.course_name} · published{" "}
                      {formatDate(assignment.created_at)}
                    </p>
                  </div>
                  <DeadlineBadge deadline={assignment.deadline} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="my-class-activity"
          className="border-border bg-surface overflow-hidden rounded-xl border"
        >
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <div>
              <h2
                id="my-class-activity"
                className="text-base font-semibold tracking-tight"
              >
                {canManage ? "Your posts" : "Your submissions"}
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {canManage
                  ? "Posts you published in this class."
                  : "Work you submitted to this class and its review state."}
              </p>
            </div>
            <Link
              href={`${base}?tab=assignments#my-submissions`}
              className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View all
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          </div>

          {submissions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium">Nothing here yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                {canManage
                  ? "Post an assignment and it publishes immediately, with an alert to members who enabled notifications."
                  : "Submit an assignment and a class admin will review it. Approved submissions are visible to signed-in students."}
              </p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{submission.title}</p>
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

      <aside className="space-y-6">
        <section
          aria-labelledby="class-information"
          className="border-border bg-surface rounded-xl border p-5"
        >
          <h2
            id="class-information"
            className="text-base font-semibold tracking-tight"
          >
            Class information
          </h2>
          {classSummary.description ? (
            <p className="text-muted-foreground mt-2 line-clamp-4 text-sm leading-relaxed">
              {classSummary.description}
            </p>
          ) : null}

          <dl className="mt-4 space-y-2.5 text-sm">
            <InfoRow
              label="Course"
              value={classSummary.course_name}
            />
            <InfoRow
              label="Semester"
              value={classSummary.semester}
            />
            <InfoRow
              label="Academic year"
              value={classSummary.academic_year}
            />
            <InfoRow
              label="Lecturer"
              value={classSummary.lecturer_name ?? "Not set"}
            />
            {classSummary.institution ? (
              <InfoRow
                label="Institution"
                value={classSummary.institution}
              />
            ) : null}
            <InfoRow
              label="Created"
              value={formatDate(classSummary.created_at)}
            />
          </dl>
        </section>

        <section
          aria-labelledby="class-subjects"
          className="border-border bg-surface overflow-hidden rounded-xl border"
        >
          <div className="border-border flex items-start justify-between gap-2 border-b px-5 py-4">
            <div>
              <h2
                id="class-subjects"
                className="text-base font-semibold tracking-tight"
              >
                Courses
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {courses.length} {pluralize(courses.length, "course")} in this
                class. Open one to see its own work.
              </p>
            </div>
            <Link
              href={`${base}/courses`}
              className="text-accent shrink-0 text-xs font-medium hover:underline"
            >
              All courses
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm font-medium">No courses yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs">
                {canManage
                  ? "Add a course before posting assignments, meetings, or schedule entries."
                  : "A class admin has not added a course yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {courses.map((course) => (
                <li
                  key={course.id}
                  className="px-5 py-3"
                >
                  <Link
                    href={`${base}/courses/${course.id}`}
                    className="hover:text-accent flex items-center justify-between gap-2 text-sm font-medium hover:underline"
                  >
                    <span className="truncate">{course.name}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                    />
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {course.task_count}{" "}
                    {pluralize(course.task_count, "assignment")}
                    {course.lecturer_name ? ` · ${course.lecturer_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <div className="border-border border-t px-5 py-3">
              <Link
                href={`${base}/manage?tab=courses`}
                className="text-accent text-xs font-medium hover:underline"
              >
                Manage courses
              </Link>
            </div>
          ) : null}
        </section>

        <section
          aria-labelledby="class-member-summary"
          className="border-border bg-surface rounded-xl border p-5"
        >
          <h2
            id="class-member-summary"
            className="text-base font-semibold tracking-tight"
          >
            Members
          </h2>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight">
              {members.length}
            </span>
            <span className="text-muted-foreground text-sm">
              {pluralize(members.length, "member")}
            </span>
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {adminCount} {pluralize(adminCount, "class admin")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium">
            <Link
              href={`${base}?tab=members`}
              className="text-accent inline-flex items-center gap-1 hover:underline"
            >
              <Users
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              View members
            </Link>
            {canManage ? (
              <Link
                href={`${base}/manage?tab=members`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ClipboardList
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Manage members
              </Link>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
