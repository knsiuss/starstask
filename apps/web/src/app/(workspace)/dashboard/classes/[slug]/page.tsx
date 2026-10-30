import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  PlusCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssignmentList } from "@/components/assignments/assignment-list";
import { Pagination } from "@/components/assignments/pagination";
import { CreateSubjectForm } from "@/components/classes/create-subject-form";
import { DeleteSubjectButton } from "@/components/classes/delete-subject-button";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ScheduleManager } from "@/components/schedule/schedule-manager";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { listClassSchedule } from "@/lib/db/class-schedule";
import { listMyClassSubmissions } from "@/lib/db/class-submissions";
import {
  getClassBySlug,
  getClassRole,
  listClassMembers,
  listClassSubjects,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { listAssignmentsQuerySchema } from "@starstask/contracts";
import { formatDate, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ClassDashboardProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassDashboardPage({
  params,
  searchParams,
}: ClassDashboardProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard"));
  }

  const { slug } = await params;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  // Membership is checked here for the page, but RLS is what actually keeps
  // these rows private for a non-member.
  if (!role.isMember) {
    notFound();
  }

  const rawQuery = await searchParams;
  const flatQuery = flattenSearchParams(rawQuery);

  const [classSubmissions, members, subjects, schedule] = await Promise.all([
    listMyClassSubmissions(session.user.id, found.id, 50),
    listClassMembers(found.id),
    listClassSubjects(found.id),
    listClassSchedule(found.id),
  ]);

  const selectedSubjectId =
    typeof flatQuery.subject === "string" ? flatQuery.subject : undefined;
  const selectedSubject = selectedSubjectId
    ? subjects.find((s) => s.id === selectedSubjectId)
    : undefined;

  const parsedQuery = listAssignmentsQuerySchema.safeParse({
    class: found.id,
    course: selectedSubject?.course_id ?? undefined,
    sort: "newest",
    page: flatQuery.page ?? "1",
    pageSize: "6",
  });

  if (!parsedQuery.success) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="error">
          <p className="font-medium">That page is not valid.</p>
          <p className="mt-1">
            <Link
              href={`/dashboard/classes/${found.slug}`}
              className="underline"
            >
              Return to the first page
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const assignments = await listAssignments(parsedQuery.data);

  // Keep stale page numbers on real results rather than an empty final page.
  if (assignments.page > assignments.totalPages) {
    redirect(
      assignments.totalPages > 1
        ? `/dashboard/classes/${found.slug}?page=${assignments.totalPages}`
        : `/dashboard/classes/${found.slug}`,
    );
  }

  const admins = members.filter((member) => member.is_admin);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
      >
        <Link
          href="/dashboard"
          className="hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Dashboard
        </Link>
        <ChevronRight
          className="text-muted-foreground/60 h-3.5 w-3.5"
          aria-hidden="true"
        />
        <Link
          href="/classes"
          className="hover:text-foreground"
        >
          My Classes
        </Link>
        <ChevronRight
          className="text-muted-foreground/60 h-3.5 w-3.5"
          aria-hidden="true"
        />
        {selectedSubject ? (
          <>
            <Link
              href={`/dashboard/classes/${found.slug}`}
              className="hover:text-foreground"
            >
              {found.name}
            </Link>
            <ChevronRight
              className="text-muted-foreground/60 h-3.5 w-3.5"
              aria-hidden="true"
            />
            <span className="text-foreground font-medium">
              {selectedSubject.name}
            </span>
          </>
        ) : (
          <span className="text-foreground font-medium">{found.name}</span>
        )}
      </nav>

      {flatQuery.posted ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          <p className="font-medium">Your post is published.</p>
          <p className="mt-1">
            Members with notifications enabled were alerted, and the assignment
            is already visible on the public class page.
          </p>
        </Alert>
      ) : null}

      {flatQuery.submitted ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Submission received. A class admin will review it before it becomes
          public.
        </Alert>
      ) : null}

      {flatQuery.revised ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Revision saved and returned to the review queue.
        </Alert>
      ) : null}

      {found.status === "archived" ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          This class is archived. It is hidden from public discovery and no
          longer accepts new submissions.
        </Alert>
      ) : null}

      <header className="border-border bg-surface mt-4 rounded-xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={found.status} />
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {found.course_name}
          </span>
          {role.isAdmin ? (
            <span className="bg-accent-soft text-accent inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
              <ShieldCheck
                aria-hidden="true"
                className="h-3 w-3"
              />
              Class admin
            </span>
          ) : null}
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {found.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {found.semester} · {found.academic_year}
          {found.lecturer_name ? ` · ${found.lecturer_name}` : ""}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {found.status === "active" ? (
            <Button asChild>
              <Link href={`/dashboard/classes/${found.slug}/submit`}>
                <PlusCircle
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                {role.canManage ? "Post assignment" : "Submit assignment"}
              </Link>
            </Button>
          ) : null}
          {role.canManage ? (
            <Button
              asChild
              variant="secondary"
            >
              <Link href={`/dashboard/classes/${found.slug}/manage`}>
                <ClipboardCheck
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Manage class and reviews
              </Link>
            </Button>
          ) : null}
          {role.canManage ? (
            <Button
              asChild
              variant="secondary"
            >
              <Link href={`/dashboard/classes/${found.slug}/leave-requests`}>
                <ClipboardList
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Absence requests
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="secondary"
            >
              <Link href={`/leave-requests/new?class=${found.slug}`}>
                <ClipboardList
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Request absence
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="secondary"
          >
            <Link href={`/dashboard/classes/${found.slug}/sessions`}>
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
              />
              Sessions
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
          >
            <Link href={`/classes/${found.slug}`}>Public class page</Link>
          </Button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section
          aria-labelledby="my-submissions"
          className="lg:col-span-2"
        >
          <h2
            id="my-submissions"
            className="text-lg font-semibold tracking-tight"
          >
            {role.canManage
              ? "My posts in this class"
              : "My submissions in this class"}
          </h2>

          {classSubmissions.length === 0 ? (
            <div className="border-border bg-subtle mt-3 rounded-lg border border-dashed px-5 py-8 text-center">
              <p className="text-sm font-medium">Nothing here yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                {role.canManage
                  ? "Post an assignment and it publishes immediately, with an alert to members who enabled notifications."
                  : "Submit an assignment and a class admin will review it. Approved submissions are visible to signed-in students."}
              </p>
            </div>
          ) : (
            <ul className="border-border divide-border mt-3 divide-y rounded-lg border">
              {classSubmissions.map((submission) => (
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
                        href={`/dashboard/classes/${found.slug}/submissions/${submission.id}/revise`}
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

        <section aria-labelledby="class-members">
          <h2
            id="class-members"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Users
              aria-hidden="true"
              className="h-4 w-4"
            />
            Members
          </h2>
          <ul className="border-border divide-border mt-3 max-h-96 divide-y overflow-y-auto rounded-lg border text-sm">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="px-4 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {member.display_name}
                  </span>
                  {member.is_admin ? (
                    <span className="text-accent shrink-0 text-xs font-medium">
                      Admin
                    </span>
                  ) : null}
                </div>
                {member.bio ? (
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-relaxed whitespace-pre-line">
                    {member.bio}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            {admins.length}{" "}
            {admins.length === 1 ? "class admin" : "class admins"}
            {" · "}
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </section>
      </div>

      <section
        aria-labelledby="class-subjects"
        className="mt-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="class-subjects"
              className="text-lg font-semibold tracking-tight"
            >
              Subjects & Courses
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              All subjects included in {found.name}. You automatically have
              access to view and submit assignments for these.
            </p>
          </div>
          {role.canManage ? <CreateSubjectForm classSlug={found.slug} /> : null}
        </div>

        {selectedSubject ? (
          <div className="border-accent/40 bg-accent-soft/30 mt-4 flex items-center justify-between rounded-xl border p-4 text-sm">
            <div>
              <p className="text-foreground font-semibold">
                Filtering by: {selectedSubject.name}
                {selectedSubject.code ? ` (${selectedSubject.code})` : ""}
              </p>
              {selectedSubject.lecturer_name ? (
                <p className="text-muted-foreground text-xs">
                  Lecturer: {selectedSubject.lecturer_name}
                </p>
              ) : null}
            </div>
            <Link
              href={`/dashboard/classes/${found.slug}`}
              className="text-accent hover:text-accent-hover text-xs font-medium underline"
            >
              Show all subjects
            </Link>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => {
            const isSelected = subject.id === selectedSubjectId;

            return (
              <div
                key={subject.id}
                className={cn(
                  "border-border bg-surface rounded-xl border p-4 transition-colors",
                  isSelected
                    ? "border-accent ring-accent ring-1"
                    : "hover:border-accent/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      <Link
                        href={`/dashboard/classes/${found.slug}?subject=${subject.id}`}
                        className="hover:underline"
                      >
                        {subject.name}
                      </Link>
                    </h3>
                    {subject.code ? (
                      <span className="font-mono bg-muted text-muted-foreground mt-1 inline-block rounded px-1.5 py-0.2 text-[10px]">
                        {subject.code}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-muted-foreground bg-muted/60 shrink-0 rounded-full px-2 py-0.5 text-xs">
                      {subject.task_count}{" "}
                      {pluralize(subject.task_count, "task")}
                    </span>
                    {role.canManage ? (
                      <DeleteSubjectButton
                        classSlug={found.slug}
                        subjectId={subject.id}
                        subjectName={subject.name}
                      />
                    ) : null}
                  </div>
                </div>
                {subject.lecturer_name ? (
                  <p className="text-muted-foreground mt-2 truncate text-xs">
                    Lecturer: {subject.lecturer_name}
                  </p>
                ) : null}
                {subject.description ? (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {subject.description}
                  </p>
                ) : null}
                <div className="border-border/50 mt-3 flex items-center justify-between border-t pt-3">
                  <Link
                    href={`/dashboard/classes/${found.slug}?subject=${subject.id}`}
                    className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    View assignments
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                  {found.status === "active" ? (
                    <Link
                      href={`/dashboard/classes/${found.slug}/submit`}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Submit
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="course-schedule"
        className="mt-10"
      >
        <h2
          id="course-schedule"
          className="text-lg font-semibold tracking-tight"
        >
          Course schedule
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The recurring weekly meeting times of each subject. Add or change the
          slots below; the shared calendar updates for every member.
        </p>
        <div className="mt-4">
          <ScheduleManager
            classSlug={found.slug}
            subjects={subjects.map((subject) => ({
              id: subject.id,
              name: subject.name,
              lecturer_name: subject.lecturer_name,
            }))}
            entries={schedule}
          />
        </div>
      </section>

      <section
        aria-labelledby="published-assignments"
        className="mt-10"
      >
        <h2
          id="published-assignments"
          className="text-lg font-semibold tracking-tight"
        >
          Published by this class
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          These assignments passed review and are visible to everyone.
        </p>
        <div className="mt-4">
          <AssignmentList
            assignments={assignments.items}
            emptyTitle="Nothing published yet"
            emptyDescription="Once a class admin approves a submission, it appears here and in assignment search."
          />
        </div>

        <Pagination
          basePath={`/dashboard/classes/${found.slug}`}
          page={assignments.page}
          totalPages={assignments.totalPages}
          params={{}}
        />
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/classes/discover">
            <GraduationCap
              aria-hidden="true"
              className="h-4 w-4"
            />
            Browse other classes
          </Link>
        </Button>
      </div>
    </div>
  );
}
