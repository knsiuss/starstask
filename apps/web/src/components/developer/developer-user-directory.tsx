import Link from "next/link";

import {
  DEVELOPER_SORT_DIRECTIONS,
  DEVELOPER_SORT_LABELS,
  DEVELOPER_USER_SORTS,
  type DeveloperUsersQuery,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DeveloperUser, DeveloperUserDirectory } from "@/lib/db/developer";

function buildPageHref(query: DeveloperUsersQuery, page: number): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  params.set("sort", query.sort);
  params.set("direction", query.direction);
  params.set("page", String(page));

  return `/developer/users?${params.toString()}`;
}

function roleBadgeVariant(role: DeveloperUser["role"]) {
  if (role === "Platform admin") {
    return "accent" as const;
  }

  if (role === "Class admin") {
    return "warning" as const;
  }

  return "neutral" as const;
}

/**
 * The raw role values come from the database in English; the console is read
 * by the operator in Indonesian, so the display labels are translated here.
 */
function roleLabel(role: DeveloperUser["role"]): string {
  if (role === "Platform admin") {
    return "Admin platform";
  }

  if (role === "Class admin") {
    return "Ketua kelas";
  }

  return "Mahasiswa";
}

function classAdminSuffix(user: DeveloperUser): string {
  return user.role === "Class admin" && user.classAdminCount > 1
    ? ` · ${user.classAdminCount} kelas`
    : "";
}

export function DeveloperUserDirectory({
  query,
  directory,
}: {
  query: DeveloperUsersQuery;
  directory: DeveloperUserDirectory;
}) {
  const firstItem =
    directory.total === 0 ? 0 : (directory.page - 1) * directory.pageSize + 1;
  const lastItem = Math.min(
    directory.total,
    directory.page * directory.pageSize,
  );
  const hasPrevious = directory.page > 1;
  const hasNext = directory.page < directory.totalPages;

  return (
    <section
      id="directory"
      aria-labelledby="directory-heading"
      className="border-border bg-surface mt-8 rounded-xl border"
    >
      <div className="border-border border-b px-4 py-4 sm:px-5">
        <h2
          id="directory-heading"
          className="text-lg font-semibold tracking-tight"
        >
          User directory
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Accounts come from the Supabase Auth admin API. Display names prefer
          the profile row; last sign-in is the single timestamp Auth keeps, not
          a full login history. Emails and NIM are personal data, so they are
          neither shown nor searchable here.
        </p>

        <form
          action="/developer/users"
          method="get"
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <Label htmlFor="developer-search">Search</Label>
            <Input
              id="developer-search"
              name="search"
              type="search"
              defaultValue={query.search ?? ""}
              maxLength={100}
              placeholder="Display name"
              className="mt-1.5"
            />
          </div>

          <div className="w-44">
            <Label htmlFor="developer-sort">Sort by</Label>
            <Select
              id="developer-sort"
              name="sort"
              defaultValue={query.sort}
              className="mt-1.5"
            >
              {DEVELOPER_USER_SORTS.map((sort) => (
                <option
                  key={sort}
                  value={sort}
                >
                  {DEVELOPER_SORT_LABELS[sort]}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Label htmlFor="developer-direction">Order</Label>
            <Select
              id="developer-direction"
              name="direction"
              defaultValue={query.direction}
              className="mt-1.5"
            >
              {DEVELOPER_SORT_DIRECTIONS.map((direction) => (
                <option
                  key={direction}
                  value={direction}
                >
                  {direction === "asc" ? "Ascending" : "Descending"}
                </option>
              ))}
            </Select>
          </div>

          <Button
            type="submit"
            size="sm"
          >
            Apply
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
          >
            <Link href="/developer/users">Reset</Link>
          </Button>
        </form>
      </div>

      {directory.truncated ? (
        <p className="border-warning/30 bg-warning-soft text-warning border-b px-4 py-2 text-xs sm:px-5">
          The Auth scan reached its safety cap. Search and totals cover only the
          scanned accounts on this deployment.
        </p>
      ) : null}

      {directory.items.length === 0 ? (
        <div className="border-border bg-subtle m-4 rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No accounts match</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs leading-relaxed">
            {query.search
              ? "Try a shorter search term, or reset the filters."
              : "No accounts exist yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs tracking-wide uppercase">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium sm:px-5"
                >
                  Account
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium"
                >
                  Last sign-in
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-medium"
                >
                  Account ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {directory.items.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 sm:px-5">
                    <p className="font-medium">
                      {user.displayName ?? "No display name"}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {roleLabel(user.role)}
                      {classAdminSuffix(user)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleBadgeVariant(user.role)}>
                      {roleLabel(user.role)}
                      {classAdminSuffix(user)}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                    {user.lastSignInAt
                      ? formatDate(user.lastSignInAt)
                      : "No sign-in recorded"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {user.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <p className="text-muted-foreground text-xs">
          {directory.total === 0
            ? "No accounts"
            : `Showing ${firstItem.toLocaleString()}–${lastItem.toLocaleString()} of ${directory.total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          {hasPrevious ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
            >
              <Link href={buildPageHref(query, directory.page - 1)}>
                Previous
              </Link>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled
            >
              Previous
            </Button>
          )}
          <span className="text-muted-foreground text-xs">
            Page {directory.page.toLocaleString()} of{" "}
            {directory.totalPages.toLocaleString()}
          </span>
          {hasNext ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
            >
              <Link href={buildPageHref(query, directory.page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
