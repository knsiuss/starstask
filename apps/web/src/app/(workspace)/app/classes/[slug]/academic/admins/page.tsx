import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GrantAdminForm } from "@/components/academic/grant-admin-form";
import { RevokeAdminButton } from "@/components/academic/revoke-admin-button";
import { ClassUnlinkedNotice } from "@/components/academic/unlinked-notice";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveClassPermissionForPage } from "@/lib/authz/class-permission";
import { listClassAdminAssignments } from "@/lib/db/class-admins";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Class admins",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ClassAdminsPage({ params }: AdminsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug } = await params;
  const access = await resolveClassPermissionForPage(slug, "manage_admins");

  if (!access.ok) {
    if (access.reason === "unlinked") {
      return (
        <PageShell slug={slug}>
          <ClassUnlinkedNotice />
        </PageShell>
      );
    }

    notFound();
  }

  const { classRow } = access;
  const assignments = await listClassAdminAssignments(classRow.id);
  const activeCount = assignments.filter((row) => !row.revokedAt).length;

  return (
    <PageShell slug={classRow.slug}>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Current admins</CardTitle>
            <CardDescription>
              {activeCount} active assignment{activeCount === 1 ? "" : "s"}. The
              database refuses to revoke the last active admin.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            {assignments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No admin assignments yet. The class relies on platform admins
                until a grant happens here.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {assignment.displayName ??
                          (assignment.userId
                            ? `User ${assignment.userId.slice(0, 8)}…`
                            : `Identity ${assignment.studentIdentityId?.slice(0, 8) ?? "?"}…`)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Granted{" "}
                        {new Date(assignment.grantedAt).toLocaleString()}
                        {assignment.revokedAt
                          ? ` · revoked ${new Date(assignment.revokedAt).toLocaleString()}`
                          : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {assignment.permissionCodes.map((code) => (
                          <Badge
                            key={code}
                            variant="neutral"
                          >
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {assignment.revokedAt ? (
                      <span className="text-muted-foreground text-xs">
                        Revoked
                      </span>
                    ) : (
                      <RevokeAdminButton
                        classSlug={classRow.slug}
                        assignmentId={assignment.id}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grant admin</CardTitle>
            <CardDescription>
              Assign one user or student identity any subset of the 8 permission
              codes. Grants are audit-logged. University scoping is enforced by
              composite keys — cross-university targets are rejected.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <GrantAdminForm classSlug={classRow.slug} />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function PageShell({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/app/classes/${slug}/academic`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Academic administration
      </Link>
      <header className="mt-4 flex items-center gap-3">
        <ShieldCheck
          aria-hidden="true"
          className="text-accent h-6 w-6"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Class admins</h1>
      </header>
      {children}
    </div>
  );
}
