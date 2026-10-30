import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserCell } from "@/components/admin/admin-user-cell";
import { AdminUserFilters } from "@/components/admin/admin-user-filters";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listPlatformUsers } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/env/public";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { adminUsersQuerySchema } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "User management",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/users");

  const raw = await searchParams;
  const parsed = adminUsersQuerySchema.safeParse(flattenSearchParams(raw));

  if (!parsed.success) {
    return (
      <div>
        <AdminPageHeader
          title="Users"
          description="Every registered account, with the class memberships it holds."
        />
        <Alert
          variant="error"
          className="mt-5"
        >
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/admin/users"
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
  const result = await listPlatformUsers(query);

  const hasActiveFilters =
    Boolean(query.search) || query.role !== "all" || query.onboarding !== "all";

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Registered accounts with their class memberships and platform access. This directory is read-only: roles are granted through trusted administrative processes, never from this console."
      />

      <div className="mt-6">
        <AdminUserFilters
          values={{
            search: query.search,
            role: query.role,
            onboarding: query.onboarding,
          }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Users
              aria-hidden="true"
              className="h-4 w-4"
            />
            Directory
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total} {result.total === 1 ? "account" : "accounts"}
          </span>
        </div>

        {hasActiveFilters ? (
          <Link
            href="/admin/users"
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
                ? "No accounts match these filters"
                : "No accounts yet"
            }
            description={
              hasActiveFilters
                ? "Clear or change the filters to see the rest of the directory."
                : "Accounts appear here after their first Google sign-in."
            }
          />
        </div>
      ) : (
        <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-subtle text-muted-foreground border-border border-b text-xs">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Account
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Joined
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Onboarding
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Classes
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Class admin
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-medium"
                  >
                    Access
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {result.items.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-subtle/60"
                  >
                    <td className="max-w-[260px] px-4 py-3">
                      <AdminUserCell
                        displayName={user.displayName}
                        avatarUrl={user.avatarUrl}
                      />
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {formatDate(user.joinedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.onboardedAt ? "success" : "warning"}>
                        {user.onboardedAt ? "Complete" : "Not complete"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {user.classCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {user.adminClassCount}
                    </td>
                    <td className="px-4 py-3">
                      {user.isPlatformAdmin ? (
                        <Badge variant="accent">
                          <ShieldCheck
                            aria-hidden="true"
                            className="h-3 w-3"
                          />
                          Platform admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Member
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        basePath="/admin/users"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          search: query.search,
          role: query.role === "all" ? undefined : query.role,
          onboarding: query.onboarding === "all" ? undefined : query.onboarding,
          pageSize: String(query.pageSize),
        }}
      />

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        Legal names and student identifiers are not exposed here. Role changes
        are performed through trusted administrative procedures with an audit
        trail, not from this page.
      </p>
    </div>
  );
}
