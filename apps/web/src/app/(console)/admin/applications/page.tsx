import { ArrowRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminApplicationFilters } from "@/components/admin/admin-application-filters";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserCell } from "@/components/admin/admin-user-cell";
import { Pagination } from "@/components/assignments/pagination";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listApplicationsForReview, loadProfiles } from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { adminApplicationsQuerySchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class applications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminApplicationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminApplicationsPage({
  searchParams,
}: AdminApplicationsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/applications");

  const raw = await searchParams;
  const parsed = adminApplicationsQuerySchema.safeParse(
    flattenSearchParams(raw),
  );

  if (!parsed.success) {
    return (
      <div>
        <AdminPageHeader
          title="Class applications"
          description="Requests to create a class, from submission through decision."
        />
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/admin/applications"
              className="underline"
            >
              Reset the list
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const query = parsed.data;
  const result = await listApplicationsForReview({
    status: query.status,
    search: query.search,
    page: query.page,
    pageSize: query.pageSize,
  });
  const profiles = await loadProfiles(
    result.items.map((application) => application.applicant_id),
  );

  const hasActiveFilters = Boolean(query.search) || query.status !== "pending";

  return (
    <div>
      <AdminPageHeader
        title="Class applications"
        description="Approving an application creates the class. Making the applicant its class admin is a separate, explicit choice on the review page."
        actions={
          <Button
            asChild
            variant="secondary"
          >
            <Link href="/admin/verifications">Verification queue</Link>
          </Button>
        }
      />

      <div className="mt-6">
        <AdminApplicationFilters
          values={{ search: query.search, status: query.status }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ClipboardList
              aria-hidden="true"
              className="h-4 w-4"
            />
            Applications
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total}
          </span>
        </div>

        {hasActiveFilters ? (
          <Link
            href="/admin/applications"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      {result.items.length === 0 ? (
        <div className="mt-4">
          <AdminEmptyState
            title={
              hasActiveFilters
                ? "No applications match these filters"
                : "No applications waiting"
            }
            description={
              hasActiveFilters
                ? "Clear or change the filters to see the rest of the list."
                : "New class applications appear here for review."
            }
          />
        </div>
      ) : (
        <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-subtle text-muted-foreground border-border border-b text-xs">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Proposed class
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Applicant
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Course
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Submitted
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {result.items.map((application) => {
                  const applicant = profiles.get(application.applicant_id);

                  return (
                    <tr
                      key={application.id}
                      className="hover:bg-subtle/60"
                    >
                      <td className="max-w-[240px] px-4 py-3">
                        <Link
                          href={`/admin/applications/${application.id}`}
                          className="hover:text-accent font-medium underline-offset-4 hover:underline"
                        >
                          {application.proposed_name}
                        </Link>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          /classes/{application.proposed_slug}
                        </p>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <AdminUserCell
                          displayName={
                            applicant?.display_name ?? "StarsTask member"
                          }
                          avatarUrl={applicant?.avatar_url ?? null}
                        />
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-xs">
                        {application.course_name}
                        <span className="block">
                          {application.semester} · {application.academic_year}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                        {formatDate(application.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        basePath="/admin/applications"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          search: query.search,
          status: query.status === "pending" ? undefined : query.status,
          pageSize: String(query.pageSize),
        }}
      />
    </div>
  );
}
