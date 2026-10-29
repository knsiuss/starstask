import {
  ArrowLeft,
  ClipboardCheck,
  FileWarning,
  History,
  Mail,
  Settings,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClassSettingsForm } from "@/components/classes/class-settings-form";
import { ClassStatusControl } from "@/components/classes/class-status-control";
import { InvitationManager } from "@/components/classes/invitation-manager";
import { MemberManager } from "@/components/classes/member-manager";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  getClassDashboardCounts,
  listClassSubmissions,
} from "@/lib/db/class-submissions";
import {
  getClassBySlug,
  getClassRole,
  isPlatformAdmin,
  listAuditLogs,
  listClassInvitations,
  listClassMembers,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Manage class",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ManageClassProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviewed?: string }>;
};

export default async function ManageClassPage({
  params,
  searchParams,
}: ManageClassProps) {
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

  const [role, platformAdmin] = await Promise.all([
    getClassRole(found.id),
    isPlatformAdmin(),
  ]);

  if (!role.canManage) {
    notFound();
  }

  const [counts, pending, published, members, invitations, audit, query] =
    await Promise.all([
      getClassDashboardCounts(found.id),
      listClassSubmissions({
        classId: found.id,
        status: "pending_review",
        page: 1,
        pageSize: 20,
      }),
      listClassSubmissions({
        classId: found.id,
        status: "published",
        page: 1,
        pageSize: 8,
      }),
      listClassMembers(found.id),
      listClassInvitations(found.id),
      listAuditLogs({ classId: found.id, page: 1, pageSize: 10 }),
      searchParams,
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${found.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to class
      </Link>

      {query.reviewed ? (
        <Alert
          variant={query.reviewed === "approved" ? "success" : "info"}
          className="mt-4"
        >
          {query.reviewed === "approved"
            ? "Submission approved and published publicly."
            : "Submission rejected. The submitter can revise and resubmit."}
        </Alert>
      ) : null}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={found.status} />
            <span className="text-muted-foreground text-xs">
              {found.course_name} · {found.semester} {found.academic_year}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Manage {found.name}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Review submissions, manage membership, and keep published content
            accurate. Approving a submission publishes it without login.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
        >
          <Link href={`/classes/${found.slug}`}>Public class page</Link>
        </Button>
      </header>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Count
          label="Members"
          value={counts.members}
        />
        <Count
          label="Pending review"
          value={counts.pendingReview}
        />
        <Count
          label="Active invites"
          value={counts.activeInvitations}
        />
        <Count
          label="Published"
          value={counts.published}
        />
        <Count
          label="Unpublished"
          value={counts.unpublished}
        />
      </dl>

      <section
        aria-labelledby="review-queue"
        className="mt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="review-queue"
              className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
            >
              <ClipboardCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
              Pending review
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              You cannot review your own submission. Approving publishes it and
              its attachments.
            </p>
          </div>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {pending.total} waiting
          </span>
        </div>

        {pending.items.length === 0 ? (
          <div className="border-border bg-subtle mt-4 rounded-lg border border-dashed px-5 py-8 text-center">
            <p className="text-sm font-medium">The queue is empty</p>
            <p className="text-muted-foreground mt-1 text-xs">
              New member submissions appear here for review.
            </p>
          </div>
        ) : (
          <ul className="divide-border border-border mt-4 divide-y rounded-lg border">
            {pending.items.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{submission.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {submission.submitter.display_name} · revision{" "}
                    {submission.revision} · submitted{" "}
                    {formatDate(submission.created_at)} ·
                    {submission.attachment_count}{" "}
                    {submission.attachment_count === 1 ? "file" : "files"}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                >
                  <Link
                    href={`/dashboard/classes/${found.slug}/review/${submission.id}`}
                  >
                    Open review
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="members">
          <h2
            id="members"
            className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Users
              aria-hidden="true"
              className="h-4 w-4"
            />
            Members
          </h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Invitation links add members. Only platform admins can grant or
            revoke the class admin role.
          </p>
          <MemberManager
            classSlug={found.slug}
            members={members}
            canManageAdmins={platformAdmin}
            currentUserId={session.user.id}
          />
        </section>

        <section aria-labelledby="invitations">
          <h2
            id="invitations"
            className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Mail
              aria-hidden="true"
              className="h-4 w-4"
            />
            Invitations
          </h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Links are hashed at rest, expire, can be limited by email, and can
            be revoked at any time.
          </p>
          <InvitationManager
            classSlug={found.slug}
            initialInvitations={invitations}
          />
        </section>
      </div>

      <section
        aria-labelledby="published-content"
        className="mt-10"
      >
        <h2
          id="published-content"
          className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <FileWarning
            aria-hidden="true"
            className="h-4 w-4"
          />
          Published content
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Unpublish, archive, or remove sensitive attachments when a published
          assignment needs moderation.
        </p>

        {published.items.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Nothing published by this class yet.
          </p>
        ) : (
          <ul className="divide-border border-border mt-3 divide-y rounded-lg border">
            {published.items.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{submission.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {submission.submitter.display_name} · published ·{" "}
                    {submission.attachment_count}{" "}
                    {submission.attachment_count === 1 ? "file" : "files"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/assignments/${submission.id}`}
                    className="text-accent text-xs font-medium hover:underline"
                  >
                    View public
                  </Link>
                  <Link
                    href={`/dashboard/classes/${found.slug}/review/${submission.id}`}
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
        aria-labelledby="recent-activity"
        className="mt-10"
      >
        <h2
          id="recent-activity"
          className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <History
            aria-hidden="true"
            className="h-4 w-4"
          />
          Recent activity
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Audit entries are append-only and never contain invitation tokens or
          personal data.
        </p>

        {audit.items.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No recorded activity yet.
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
                  {entry.entity_type.replaceAll("_", " ")} ·{" "}
                  {formatDate(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="class-settings">
          <h2
            id="class-settings"
            className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Settings
              aria-hidden="true"
              className="h-4 w-4"
            />
            Class settings
          </h2>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            The class slug is permanent so public links never break.
          </p>
          <ClassSettingsForm
            classSlug={found.slug}
            initialValues={{
              name: found.name,
              description: found.description,
              courseName: found.course_name,
              institution: found.institution ?? "",
              lecturerName: found.lecturer_name ?? "",
              semester: found.semester,
              academicYear: found.academic_year,
            }}
          />
        </section>

        {platformAdmin ? (
          <section aria-labelledby="platform-controls">
            <h2
              id="platform-controls"
              className="text-xl font-semibold tracking-tight"
            >
              Platform controls
            </h2>
            <div className="border-border mt-4 rounded-lg border p-4">
              <ClassStatusControl
                classSlug={found.slug}
                status={found.status}
                redirectTo={`/dashboard/classes/${found.slug}/manage`}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-surface rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-xl font-semibold">{value}</dd>
    </div>
  );
}
