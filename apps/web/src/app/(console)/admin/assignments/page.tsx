import { ArrowRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminAssignmentFilters } from "@/components/admin/admin-assignment-filters";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserCell } from "@/components/admin/admin-user-cell";
import { Pagination } from "@/components/assignments/pagination";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listAdminAssignments, listAdminClassOptions } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/env/public";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { adminAssignmentQuerySchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Assignment management",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminAssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAssignmentsPage({
  searchParams,
}: AdminAssignmentsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/assignments");

  const raw = await searchParams;
  const parsed = adminAssignmentQuerySchema.safeParse(flattenSearchParams(raw));

  if (!parsed.success) {
    return (
      <div>
        <AdminPageHeader
          title="Assignments"
          description="Class submissions across every class, with their review and publication state."
        />
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/admin/assignments"
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
  const [result, classes] = await Promise.all([
    listAdminAssignments(query),
    listAdminClassOptions(),
  ]);

  const hasActiveFilters =
    Boolean(query.search) || query.status !== "all" || Boolean(query.class);

  return (
    <div>
      <AdminPageHeader
        title="Assignments"
        description="Every class submission is reviewed by a class admin. Opening Review or Moderate reuses the existing class workflow, where publishing, unpublishing, and archiving are validated server-side."
        actions={
          <Button
            asChild
            variant="secondary"
          >
            <Link href="/admin/classes">Browse classes</Link>
          </Button>
        }
      />

      <div className="mt-6">
        <AdminAssignmentFilters
          values={{
            search: query.search,
            status: query.status,
            classId: query.class,
          }}
          classes={classes}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <FileText
              aria-hidden="true"
              className="h-4 w-4"
            />
            Class submissions
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total}
          </span>
        </div>

        {hasActiveFilters ? (
          <Link
            href="/admin/assignments"
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
                ? "No assignments match these filters"
                : "No class submissions yet"
            }
            description={
              hasActiveFilters
                ? "Clear or change the filters to see the rest of the list."
                : "Submissions appear here once a class member sends one for review."
            }
          />
        </div>
      ) : (
        <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-subtle text-muted-foreground border-border border-b text-xs">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Assignment
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Class
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Submitter
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Updated
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Deadline
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
                {result.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-subtle/60"
                  >
                    <td className="max-w-[260px] px-4 py-3">
                      <Link
                        href={`/dashboard/classes/${item.classSlug}/review/${item.id}`}
                        className="hover:text-accent font-medium underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="text-muted-foreground max-w-[200px] px-4 py-3 text-xs">
                      <Link
                        href={`/admin/classes/${item.classSlug}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {item.className}
                      </Link>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <AdminUserCell
                        displayName={item.submitter.displayName}
                        avatarUrl={item.submitter.avatarUrl}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {item.deadline ? formatDate(item.deadline) : "None"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                      >
                        <Link
                          href={`/dashboard/classes/${item.classSlug}/review/${item.id}`}
                        >
                          {item.status === "pending_review"
                            ? "Review"
                            : "Moderate"}
                          <ArrowRight
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        basePath="/admin/assignments"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          search: query.search,
          status: query.status === "all" ? undefined : query.status,
          class: query.class,
          pageSize: String(query.pageSize),
        }}
      />

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        Only class-scoped assignments are listed. Moderation actions are
        recorded with a reason and notify the submitter; attachments are never
        made public from this page.
      </p>
    </div>
  );
}
