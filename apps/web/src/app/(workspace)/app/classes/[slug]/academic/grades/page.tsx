import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassUnlinkedNotice } from "@/components/academic/unlinked-notice";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveClassPermissionForPage } from "@/lib/authz/class-permission";
import { listOfferingsForClass } from "@/lib/db/course-offerings";
import {
  listGradeBatchesForClass,
  listGradeHistoryForClass,
} from "@/lib/db/grades-readonly";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Grades (read-only)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type GradesPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Read-only grading oversight: batch status and the change ledger. No
 * publish/upload actions exist — the CSV column mapping is unresolved and
 * grade publication remains disabled by design.
 */
export default async function AcademicGradesPage({ params }: GradesPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug } = await params;
  const access = await resolveClassPermissionForPage(slug, "manage_grades");

  if (!access.ok) {
    if (access.reason === "unlinked") {
      return (
        <Shell slug={slug}>
          <ClassUnlinkedNotice />
        </Shell>
      );
    }

    notFound();
  }

  const { classRow } = access;
  const offerings = await listOfferingsForClass(classRow.id);
  const offeringIds = offerings.map((offering) => offering.id);
  const offeringNameById = new Map(
    offerings.map((offering) => [
      offering.id,
      offering.courseCode
        ? `${offering.courseCode} · ${offering.courseName}`
        : offering.courseName,
    ]),
  );
  const [batches, history] = await Promise.all([
    listGradeBatchesForClass(offeringIds),
    listGradeHistoryForClass(offeringIds),
  ]);

  return (
    <Shell slug={classRow.slug}>
      <Alert
        variant="info"
        className="mt-6"
      >
        Grade import and publication are disabled until Product decides the CSV
        column mapping (decision register #1). This page is read-only and shows
        batch status and the change ledger only.
      </Alert>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Grade batches</CardTitle>
          <CardDescription>
            Uploaded verification batches for this class&apos;s offerings.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {batches.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No grade batches yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="py-2 pr-4">Offering</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Entries</th>
                    <th className="py-2 pr-4">Published</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="border-border border-t"
                    >
                      <td className="py-2 pr-4">
                        {offeringNameById.get(batch.offeringId) ??
                          batch.offeringId.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="neutral">{batch.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">{batch.entryCount}</td>
                      <td className="py-2 pr-4">
                        {batch.publishedEntryCount} / {batch.entryCount}
                      </td>
                      <td className="text-muted-foreground py-2">
                        {new Date(batch.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Change ledger</CardTitle>
          <CardDescription>
            Latest recorded grade corrections (who, when, from → to, why).
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No grade changes recorded.
            </p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-medium">
                      {entry.component ?? "entry"}: {entry.oldScore} →{" "}
                      {entry.newScore}
                    </span>
                    {entry.reason ? (
                      <span className="text-muted-foreground block text-xs">
                        {entry.reason}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(entry.changedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </Shell>
  );
}

function Shell({ slug, children }: { slug: string; children: ReactNode }) {
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
        <BookOpen
          aria-hidden="true"
          className="text-accent h-6 w-6"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Grades (read-only)
        </h1>
      </header>
      {children}
    </div>
  );
}
