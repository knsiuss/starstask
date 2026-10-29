import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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

  const rawParams = await searchParams;
  const parsed = listAssignmentsQuerySchema.safeParse({
    ...flattenParams(rawParams),
    class: found.id,
    pageSize: "12",
  });

  if (!parsed.success) {
    notFound();
  }

  const [session, assignments] = await Promise.all([
    getSessionUser(),
    listAssignments(parsed.data),
  ]);

  const role = session ? await getClassRole(found.id) : null;
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
        All classes
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
          ) : session ? (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <ShieldCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
              Membership is by invitation from a class admin. Ask your lecturer
              or class admin for the invitation link.
            </p>
          ) : (
            <Button asChild>
              <Link href={buildLoginPath(`/classes/${found.slug}`)}>
                Sign in to join this class
              </Link>
            </Button>
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
            emptyDescription="Class members can submit assignments; once a class admin approves one, it is published here for everyone."
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

function flattenParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const candidate =
      typeof value === "string"
        ? value
        : Array.isArray(value) && typeof value[0] === "string"
          ? value[0]
          : undefined;

    if (candidate) {
      flat[key] = candidate;
    }
  }

  return flat;
}
