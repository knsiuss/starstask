import { ArrowLeft, ClipboardCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import { ClassStatusControl } from "@/components/classes/class-status-control";
import { MemberManager } from "@/components/classes/member-manager";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getClassDashboardCounts } from "@/lib/db/class-submissions";
import {
  getClassBySlug,
  listAuditLogs,
  listClassMembers,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Manage class as platform admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminClassPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminClassPage({ params }: AdminClassPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await requirePlatformAdmin("/admin/classes");

  const { slug } = await params;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const [counts, members, audit] = await Promise.all([
    getClassDashboardCounts(found.id),
    listClassMembers(found.id),
    listAuditLogs({ classId: found.id, page: 1, pageSize: 10 }),
  ]);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/classes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Class management
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={found.status} />
            <span className="text-muted-foreground text-xs">
              {found.course_name} · {found.semester} {found.academic_year}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {found.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Created {formatDate(found.created_at)} · /classes/{found.slug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="secondary"
          >
            <Link href={`/classes/${found.slug}`}>Public page</Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/classes/${found.slug}/manage`}>
              <ClipboardCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
              Review queue
            </Link>
          </Button>
        </div>
      </header>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Count
          label="Members"
          value={counts.members}
        />
        <Count
          label="Pending review"
          value={counts.pendingReview}
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
            Members and class admins
          </h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            Platform admins can grant or revoke the class admin role. A class
            always keeps at least one admin.
          </p>
          <MemberManager
            classSlug={found.slug}
            members={members}
            canManageAdmins
            currentUserId={session.user.id}
          />
        </section>

        <div className="space-y-8">
          <section aria-labelledby="status">
            <h2
              id="status"
              className="text-xl font-semibold tracking-tight"
            >
              Class status
            </h2>
            <div className="border-border mt-3 rounded-lg border p-4">
              <ClassStatusControl
                classSlug={found.slug}
                status={found.status}
                redirectTo={`/admin/classes/${found.slug}`}
              />
            </div>
          </section>

          <section aria-labelledby="audit">
            <h2
              id="audit"
              className="text-xl font-semibold tracking-tight"
            >
              Recent audit entries
            </h2>
            {audit.items.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                No activity recorded yet.
              </p>
            ) : (
              <ul className="divide-border border-border mt-3 divide-y rounded-lg border text-sm">
                {audit.items.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="font-mono text-xs">
                      {entry.action.replaceAll("_", " ")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
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
