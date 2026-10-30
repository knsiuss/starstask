import { ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { StatusBadge } from "@/components/classes/status-badge";
import { Button } from "@/components/ui/button";
import type { ClassApplicationView } from "@/lib/db/classes";
import { formatDate } from "@starstask/shared";

type ApplicantProfiles = ReadonlyMap<
  string,
  { display_name: string; avatar_url: string | null }
>;

export function PendingApplicationsPanel({
  items,
  total,
  applicants,
}: {
  items: ClassApplicationView[];
  total: number;
  applicants: ApplicantProfiles;
}) {
  return (
    <section
      aria-labelledby="pending-applications"
      className="border-border bg-surface rounded-xl border lg:col-span-2"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2
            id="pending-applications"
            className="inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <ClipboardList
              aria-hidden="true"
              className="h-4 w-4"
            />
            Class applications
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Approving creates the class. The class admin role stays a separate
            decision.
          </p>
        </div>
        <Link
          href="/admin/applications?status=pending"
          className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          {total} waiting
          <ArrowRight
            aria-hidden="true"
            className="h-3 w-3"
          />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="p-4">
          <AdminEmptyState
            title="No applications waiting"
            description="New class applications appear here for review."
          />
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {items.map((application) => {
            const applicant = applicants.get(application.applicant_id);

            return (
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
                    {application.academic_year} ·{" "}
                    {applicant?.display_name ?? "StarsTask member"} ·{" "}
                    {formatDate(application.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={application.status} />
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                  >
                    <Link href={`/admin/applications/${application.id}`}>
                      Review
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
