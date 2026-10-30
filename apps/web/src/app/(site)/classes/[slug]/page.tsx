import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssignmentList } from "@/components/assignments/assignment-list";
import { Pagination } from "@/components/assignments/pagination";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { listAssignmentsQuerySchema } from "@starstask/contracts";

export const dynamic = "force-dynamic";

type ClassPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: Pick<ClassPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return { title: "Class not found" };
  }

  const found = await getClassBySlug(slug);

  if (!found) {
    return {
      title: "Class not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: found.name,
    description: `${found.course_name} · ${found.semester} ${found.academic_year}. Approved assignments published by this class.`,
    alternates: { canonical: `/classes/${found.slug}` },
    robots:
      found.status === "active"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

export default async function ClassPage({
  params,
  searchParams,
}: ClassPageProps) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/classes/${found.slug}`));
  }

  const rawParams = await searchParams;
  const parsed = listAssignmentsQuerySchema.safeParse({
    ...flattenSearchParams(rawParams),
    class: found.id,
    pageSize: "12",
  });

  if (!parsed.success) {
    notFound();
  }

  const [role, assignments] = await Promise.all([
    getClassRole(found.id),
    listAssignments(parsed.data),
  ]);

  const joined = role?.isMember ?? false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/classes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Classes
      </Link>

      <header className="border-border bg-surface mt-4 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge status={found.status} />
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-medium">
            {found.course_name}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {found.name}
        </h1>

        <dl className="text-muted-foreground mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div className="inline-flex items-center gap-2">
            <GraduationCap
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <dt className="sr-only">Academic period</dt>
            <dd>
              {found.semester} · {found.academic_year}
            </dd>
          </div>
          {found.lecturer_name ? (
            <div className="inline-flex items-center gap-2">
              <UserRound
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Lecturer</dt>
              <dd>{found.lecturer_name}</dd>
            </div>
          ) : null}
          {found.institution ? (
            <div className="inline-flex items-center gap-2">
              <BookOpen
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Institution</dt>
              <dd>{found.institution}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-muted-foreground mt-5 max-w-3xl text-sm leading-relaxed whitespace-pre-line">
          {found.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            asChild
            variant="secondary"
          >
            <a
              href={`/api/classes/${found.slug}/calendar`}
              download={`starstask-${found.slug}.ics`}
            >
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
              />
              Subscribe to calendar
            </a>
          </Button>

          {joined ? (
            <Button asChild>
              <Link href={`/dashboard/classes/${found.slug}`}>
                <LayoutDashboard
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Open class dashboard
              </Link>
            </Button>
          ) : (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <ShieldCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
              Membership is by invitation from a class admin. Ask the class
              admin (ketua kelas) for the invitation link.
            </p>
          )}

          {role?.canManage ? (
            <Button
              asChild
              variant="secondary"
            >
              <Link href={`/dashboard/classes/${found.slug}/manage`}>
                Manage class
              </Link>
            </Button>
          ) : null}
        </div>

        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          The calendar feed contains published deadlines and public sessions.
          Download it while signed in to keep deadlines in sync.
        </p>
      </header>

      <section
        aria-labelledby="class-assignments"
        className="mt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="class-assignments"
              className="text-xl font-semibold tracking-tight"
            >
              Approved assignments
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Only assignments a class admin approved appear here. Pending and
              rejected submissions stay private.
            </p>
          </div>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {assignments.total}{" "}
            {assignments.total === 1 ? "assignment" : "assignments"}
          </span>
        </div>

        <div className="mt-4">
          <AssignmentList
            assignments={assignments.items}
            emptyTitle="No published assignments yet"
            emptyDescription="Class members submit assignments for a class admin to review, and a class admin's own post is published here immediately."
          />
        </div>

        <Pagination
          basePath={`/classes/${found.slug}`}
          page={assignments.page}
          totalPages={assignments.totalPages}
          params={{ pageSize: String(assignments.pageSize) }}
        />
      </section>
    </div>
  );
}
