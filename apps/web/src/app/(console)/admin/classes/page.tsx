import { ArrowRight, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminClassFilters } from "@/components/admin/admin-class-filters";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Pagination } from "@/components/assignments/pagination";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listPlatformClasses } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/env/public";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { adminClassesQuerySchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Class management",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminClassesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminClassesPage({
  searchParams,
}: AdminClassesPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/classes");

  const raw = await searchParams;
  const parsed = adminClassesQuerySchema.safeParse(flattenSearchParams(raw));

  if (!parsed.success) {
    return (
      <div>
        <AdminPageHeader
          title="Classes"
          description="Approved classes, their members, and the class admins assigned to them."
        />
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/admin/classes"
              className="underline"
            >
              Reset the directory
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const query = parsed.data;
  const result = await listPlatformClasses(query);

  const hasActiveFilters = Boolean(query.search) || query.status !== "all";

  return (
    <div>
      <AdminPageHeader
        title="Classes"
        description="Platform-wide class inventory with counts computed by the database. Opening a class lets you review members, assign class admins, and change its status."
        actions={
          <Button
            asChild
            variant="secondary"
          >
            <Link href="/admin/applications?status=pending">
              Pending applications
            </Link>
          </Button>
        }
      />

      <div className="mt-6">
        <AdminClassFilters
          values={{ search: query.search, status: query.status }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <GraduationCap
              aria-hidden="true"
              className="h-4 w-4"
            />
            Class directory
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total}
          </span>
        </div>

        {hasActiveFilters ? (
          <Link
            href="/admin/classes"
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
                ? "No classes match these filters"
                : "No classes yet"
            }
            description={
              hasActiveFilters
                ? "Clear or change the filters to see the rest of the directory."
                : "An approved class application creates the first class."
            }
            action={
              hasActiveFilters ? null : (
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                >
                  <Link href="/admin/applications?status=pending">
                    Review applications
                  </Link>
                </Button>
              )
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
                    Class
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Course
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Members
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Class admins
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
                    Created
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
                    <td className="max-w-[240px] px-4 py-3">
                      <Link
                        href={`/admin/classes/${item.slug}`}
                        className="hover:text-accent font-medium underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {item.institution ?? "Institution not specified"} · /
                        {item.slug}
                      </p>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {item.courseName}
                      <span className="block">
                        {item.semester} · {item.academicYear}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.memberCount}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs">
                      {item.adminNames.length === 0 ? (
                        <span className="text-muted-foreground">
                          No class admin
                        </span>
                      ) : (
                        <>
                          <span className="block truncate">
                            {item.adminNames.slice(0, 2).join(", ")}
                          </span>
                          {item.adminCount > 2 ? (
                            <span className="text-muted-foreground">
                              +{item.adminCount - 2} more
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                      >
                        <Link href={`/admin/classes/${item.slug}`}>
                          Manage
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
        basePath="/admin/classes"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          search: query.search,
          status: query.status === "all" ? undefined : query.status,
          pageSize: String(query.pageSize),
        }}
      />
    </div>
  );
}
