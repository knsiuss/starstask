import {
  ArrowRight,
  ClipboardList,
  FileWarning,
  GraduationCap,
  History,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  getPlatformDashboardCounts,
  listPlatformModerationQueue,
} from "@/lib/db/class-submissions";
import {
  isPlatformAdmin,
  listAllClasses,
  listApplicationsForReview,
  listAuditLogs,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Platform administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ decided?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/admin"));
  }

  if (!(await isPlatformAdmin())) {
    notFound();
  }

  const [counts, pendingApplications, classes, moderation, audit, query] =
    await Promise.all([
      getPlatformDashboardCounts(),
      listApplicationsForReview("pending", 1, 10),
      listAllClasses(),
      listPlatformModerationQueue(8),
      listAuditLogs({ page: 1, pageSize: 10 }),
      searchParams,
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-accent inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <ShieldCheck
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Platform admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Platform administration
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Review class applications, assign class admins, and moderate
            published content. Platform admins and class admins have separate
            scopes.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
        >
          <Link href="/classes">Browse public classes</Link>
        </Button>
      </header>

      {query.decided ? (
        <Alert
          variant={query.decided === "approved" ? "success" : "info"}
          className="mt-4"
        >
          {query.decided === "approved"
            ? "Class application approved."
            : "Class application rejected and the applicant notified."}
        </Alert>
      ) : null}

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Count
          label="Pending applications"
          value={counts.pendingApplications}
        />
        <Count
          label="Active classes"
          value={counts.activeClasses}
        />
        <Count
          label="Archived classes"
          value={counts.archivedClasses}
        />
        <Count
          label="Unpublished assignments"
          value={counts.unpublishedAssignments}
        />
      </dl>

      <section
        aria-labelledby="pending-applications"
        className="mt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="pending-applications"
              className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
            >
              <ClipboardList
                aria-hidden="true"
                className="h-4 w-4"
              />
              Pending class applications
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Approving creates the class. Only approve the class admin role
              when the applicant should manage it.
            </p>
          </div>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {pendingApplications.total} waiting
          </span>
        </div>

        {pendingApplications.items.length === 0 ? (
          <div className="border-border bg-subtle mt-4 rounded-lg border border-dashed px-5 py-8 text-center">
            <p className="text-sm font-medium">No applications waiting</p>
            <p className="text-muted-foreground mt-1 text-xs">
              New class applications appear here for review.
            </p>
          </div>
        ) : (
          <ul className="divide-border border-border mt-4 divide-y rounded-lg border">
            {pendingApplications.items.map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/applications/${application.id}`}
                    className="hover:text-accent font-medium underline-offset-4 hover:underline"
                  >
                    {application.proposed_name}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {application.course_name} · {application.semester}{" "}
                    {application.academic_year} · submitted{" "}
                    {formatDate(application.created_at)}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                >
                  <Link href={`/admin/applications/${application.id}`}>
                    Review
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="classes"
        className="mt-10"
      >
        <h2
          id="classes"
          className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <GraduationCap
            aria-hidden="true"
            className="h-4 w-4"
          />
          Classes
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Assign or revoke class admins, review membership, and archive a class.
        </p>

        {classes.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No classes exist yet.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border">
            {classes.map((classItem) => (
              <li
                key={classItem.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/classes/${classItem.slug}`}
                    className="hover:text-accent font-medium underline-offset-4 hover:underline"
                  >
                    {classItem.name}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {classItem.course_name} · {classItem.semester}{" "}
                    {classItem.academic_year} · created{" "}
                    {formatDate(classItem.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={classItem.status} />
                  <Link
                    href={`/admin/classes/${classItem.slug}`}
                    className="text-accent text-xs font-medium hover:underline"
                  >
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="moderation"
        className="mt-10"
      >
        <h2
          id="moderation"
          className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <FileWarning
            aria-hidden="true"
            className="h-4 w-4"
          />
          Published content moderation
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Class assignments that are public, unpublished, or archived, newest
          first.
        </p>

        {moderation.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No class assignments to review.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border">
            {moderation.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {item.class_name} · {item.submitter.display_name} · updated{" "}
                    {formatDate(item.updated_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={item.status} />
                  <Link
                    href={`/dashboard/classes/${item.class_slug}/review/${item.id}`}
                    className="text-accent text-xs font-medium hover:underline"
                  >
                    Moderate
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="audit"
        className="mt-10"
      >
        <h2
          id="audit"
          className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <History
            aria-hidden="true"
            className="h-4 w-4"
          />
          Audit history
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Append-only platform records. Metadata never includes tokens, emails,
          or credentials.
        </p>

        {audit.items.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No audit entries yet.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border">
            {audit.items.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span className="font-mono text-xs">
                  {entry.action.replaceAll("_", " ")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {entry.entity_type.replaceAll("_", " ")}
                  {entry.class_id ? " · class scoped" : ""} ·{" "}
                  {formatDate(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-surface rounded-lg border p-4">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}
