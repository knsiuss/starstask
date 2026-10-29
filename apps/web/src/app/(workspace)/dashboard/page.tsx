import {
  ArrowRight,
  FileText,
  GraduationCap,
  MailPlus,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  getMemberDashboardCounts,
  listMyClassSubmissions,
} from "@/lib/db/class-submissions";
import { listMyApplications, listMyClasses } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your classes, applications, and submissions on StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard"));
  }

  const [counts, classes, applications, submissions] = await Promise.all([
    getMemberDashboardCounts(session.user.id),
    listMyClasses(session.user.id),
    listMyApplications(session.user.id),
    listMyClassSubmissions(session.user.id, 8),
  ]);

  const openApplications = applications.filter(
    (application) =>
      application.status === "pending" || application.status === "rejected",
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back
            {session.profile?.display_name
              ? `, ${session.profile.display_name.split(" ")[0]}`
              : ""}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Your classes, class applications, and assignment submissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="secondary"
          >
            <Link href="/dashboard/applications">
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              Apply to create a class
            </Link>
          </Button>
          <Button asChild>
            <Link href="/submit">
              <FileText
                aria-hidden="true"
                className="h-4 w-4"
              />
              Submit assignment
            </Link>
          </Button>
        </div>
      </header>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My classes"
          value={counts.classes}
          href="/classes"
        />
        <StatCard
          label="Open applications"
          value={counts.openApplications}
          href="/dashboard/applications"
        />
        <StatCard
          label="Awaiting review"
          value={counts.pendingSubmissions}
          href="/my-assignments"
        />
        <StatCard
          label="Published"
          value={counts.publishedAssignments}
          href="/my-assignments"
        />
      </dl>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section
          aria-labelledby="my-classes"
          className="lg:col-span-2"
        >
          <SectionHeader
            id="my-classes"
            title="My classes"
            description="Classes you belong to. Class admins manage membership."
            href="/classes"
            linkLabel="Browse classes"
          />

          {classes.length === 0 ? (
            <EmptyState
              title="You have not joined a class yet"
              description="Membership is by invitation from a class admin. Open the invitation link you were given, or browse approved classes."
              actionHref="/classes"
              actionLabel="Browse classes"
            />
          ) : (
            <ul className="border-border divide-border mt-4 divide-y rounded-lg border">
              {classes.map((classItem) => (
                <li
                  key={classItem.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/classes/${classItem.slug}`}
                      className="hover:text-accent font-medium underline-offset-4 hover:underline"
                    >
                      {classItem.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {classItem.course_name} · {classItem.semester}{" "}
                      {classItem.academic_year}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={classItem.status} />
                    {classItem.is_admin ? (
                      <span className="bg-accent-soft text-accent inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
                        <ShieldCheck
                          aria-hidden="true"
                          className="h-3 w-3"
                        />
                        Class admin
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="invitations">
          <SectionHeader
            id="invitations"
            title="Invitations"
            description="Class admins share invitation links directly."
          />
          <div className="border-border bg-surface mt-4 rounded-lg border p-4">
            <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
              <MailPlus
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Open the invitation link a class admin sent you while signed in.
              Links can be single-use, limited by email, and expire.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Invitation links never grant admin permissions.
            </p>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="my-applications"
        className="mt-10"
      >
        <SectionHeader
          id="my-applications"
          title="My class applications"
          description="Only a platform admin can approve or reject an application."
        />

        {applications.length === 0 ? (
          <EmptyState
            title="No class applications"
            description="Any signed-in user may apply to create a class. A platform admin reviews every application before the class becomes active."
            actionHref="/dashboard/applications"
            actionLabel="Start an application"
          />
        ) : (
          <ul className="border-border divide-border mt-4 divide-y rounded-lg border">
            {applications.slice(0, 6).map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="hover:text-accent font-medium underline-offset-4 hover:underline"
                  >
                    {application.proposed_name}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {application.course_name} · {application.semester}{" "}
                    {application.academic_year} · submitted{" "}
                    {formatDate(application.created_at)}
                  </p>
                  {application.status === "rejected" &&
                  application.decision_note ? (
                    <p className="text-danger mt-1 text-xs">
                      Reviewer note: {application.decision_note}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}

        {openApplications.length > 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">
            You can correct a rejected application and resubmit it from its
            detail page.
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="my-submissions"
        className="mt-10"
      >
        <SectionHeader
          id="my-submissions"
          title="Class assignment submissions"
          description="Approved submissions are published publicly. Rejected submissions can be revised and resubmitted."
          href="/my-assignments"
          linkLabel="All submissions"
        />

        {submissions.length === 0 ? (
          <EmptyState
            title="No class submissions yet"
            description="Open one of your classes and submit an assignment for its admin to review."
            actionHref={
              classes[0] ? `/dashboard/classes/${classes[0].slug}` : "/classes"
            }
            actionLabel={classes[0] ? "Open a class" : "Browse classes"}
          />
        ) : (
          <ul className="border-border divide-border mt-4 divide-y rounded-lg border">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="font-medium">{submission.title}</span>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {submission.class_name} · revision {submission.revision} ·
                    updated {formatDate(submission.updated_at)}
                  </p>
                  {submission.status === "rejected" &&
                  submission.rejection_reason ? (
                    <p className="text-danger mt-1 text-xs">
                      {submission.rejection_reason}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                      href={`/dashboard/classes/${submission.class_slug}/submissions/${submission.id}/revise`}
                      className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    >
                      Revise
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
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

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <div className="border-border bg-surface rounded-lg border p-4">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        <Link
          href={href}
          className="text-accent text-xs font-medium hover:underline"
        >
          Open
        </Link>
      </dd>
    </div>
  );
}

function SectionHeader({
  id,
  title,
  description,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2
          id={id}
          className="text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          {description}
        </p>
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          {linkLabel}
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="border-border bg-subtle mt-4 rounded-lg border border-dashed px-6 py-10 text-center">
      <GraduationCap
        aria-hidden="true"
        className="text-muted-foreground mx-auto h-6 w-6"
      />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
        {description}
      </p>
      <Button
        asChild
        className="mt-4"
        size="sm"
      >
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
