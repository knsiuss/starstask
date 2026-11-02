import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssignmentReportCard } from "@/components/admin/assignment-report-card";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listAssignmentReports } from "@/lib/db/assignment-trust";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Reader reports",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ClassReportsPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Open reader reports for one class. The query is class-wide but RLS already
 * limits rows to classes the caller manages; the explicit filter keeps this
 * page scoped when a leader manages several classes.
 */
export default async function ClassReportsPage({
  params,
}: ClassReportsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();
  const { slug } = await params;

  if (!session) {
    redirect(buildLoginPath(`/dashboard/classes/${slug}/reports`));
  }

  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.canManage) {
    notFound();
  }

  const reports = (await listAssignmentReports("open", { classId: found.id }))
    .items;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${found.slug}/manage`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to class management
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reader reports
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Corrections readers submitted for published assignments in{" "}
          {found.name}. Fix the brief on the assignment page, then resolve the
          report with a short note.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No open reports</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
            Readers can report a problem from any published assignment. Nothing
            is waiting for you in this class right now.
          </p>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            <Link href={`/dashboard/classes/${found.slug}/manage`}>
              Review submissions
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reports.map((report) => (
            <AssignmentReportCard
              key={report.id}
              report={report}
            />
          ))}
        </div>
      )}
    </div>
  );
}
