import {
  ArrowLeft,
  ClipboardCheck,
  GraduationCap,
  PlusCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssignmentList } from "@/components/assignments/assignment-list";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { listMyClassSubmissions } from "@/lib/db/class-submissions";
import {
  getClassBySlug,
  getClassRole,
  listClassMembers,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { listAssignmentsQuerySchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ClassDashboardProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ submitted?: string; revised?: string }>;
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

  const [assignments, submissions, members, query] = await Promise.all([
    listAssignments(
      listAssignmentsQuerySchema.parse({
        class: found.id,
        sort: "newest",
        page: "1",
        pageSize: "6",
      }),
    ),
    listMyClassSubmissions(session.user.id, 50),
    listClassMembers(found.id),
    searchParams,
  ]);

  const classSubmissions = submissions.filter(
    (submission) => submission.class_id === found.id,
  );
  const admins = members.filter((member) => member.is_admin);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Dashboard
      </Link>

      {query.submitted ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Submission received. A class admin will review it before it becomes
          public.
        </Alert>
      ) : null}

      {query.revised ? (
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
                Submit assignment
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
            My submissions in this class
          </h2>

          {classSubmissions.length === 0 ? (
            <div className="border-border bg-subtle mt-3 rounded-lg border border-dashed px-5 py-8 text-center">
              <p className="text-sm font-medium">Nothing submitted yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                Submit an assignment and a class admin will review it. Approved
                submissions are published publicly.
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
                className="flex items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="min-w-0 truncate">{member.display_name}</span>
                {member.is_admin ? (
                  <span className="text-accent shrink-0 text-xs font-medium">
                    Admin
                  </span>
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
            emptyDescription="Once a class admin approves a submission, it appears here and in public search."
          />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/classes">
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
