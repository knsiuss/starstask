import type { Metadata } from "next";

import {
  DEVELOPER_PAGE_SIZE,
  developerUsersQuerySchema,
  type DeveloperUsersQuery,
} from "@starstask/contracts";

import { DeveloperAccessDenied } from "@/components/developer/developer-access-denied";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { DeveloperUserDirectory } from "@/components/developer/developer-user-directory";
import { Alert } from "@/components/ui/alert";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { DataAccessError } from "@/lib/db/assignments";
import { listDeveloperUsers } from "@/lib/db/developer";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer console · Users",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEFAULT_QUERY: DeveloperUsersQuery = {
  search: undefined,
  sort: "created_at",
  direction: "desc",
  page: 1,
  pageSize: DEVELOPER_PAGE_SIZE,
};

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseQuery(params: Record<string, string | string[] | undefined>): {
  query: DeveloperUsersQuery;
  invalid: boolean;
} {
  const parsed = developerUsersQuerySchema.safeParse({
    search: firstValue(params.search),
    sort: firstValue(params.sort),
    direction: firstValue(params.direction),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  if (parsed.success) {
    return { query: parsed.data, invalid: false };
  }

  return { query: DEFAULT_QUERY, invalid: true };
}

export default async function DeveloperUsersPage({
  searchParams,
}: UsersPageProps) {
  const access = await requireDeveloperPageAccess("/developer/users");

  // The layout renders the denial, but this page re-checks independently and
  // never starts a service-role read for a caller who is not allowlisted.
  if (access.status !== "allowed") {
    return (
      <DeveloperAccessDenied
        status={access.status === "unconfigured" ? "unconfigured" : "denied"}
      />
    );
  }

  const { query, invalid } = parseQuery(await searchParams);

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Users"
        description="Every account in Supabase Auth, with the profile display name and resolved role. Emails and NIM are personal data, so they are neither shown nor searchable here."
      />

      {!isServiceRoleConfigured() ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          The server-side monitoring data source is not configured. The
          directory stays unavailable rather than falling back to partial client
          data.
        </Alert>
      ) : (
        <UsersBody
          query={query}
          invalidQuery={invalid}
        />
      )}
    </div>
  );
}

async function UsersBody({
  query,
  invalidQuery,
}: {
  query: DeveloperUsersQuery;
  invalidQuery: boolean;
}) {
  let directory: Awaited<ReturnType<typeof listDeveloperUsers>> | null = null;

  try {
    directory = await listDeveloperUsers(query);
  } catch (error) {
    console.error("[developer] user directory load failed", {
      name: error instanceof Error ? error.name : "unknown",
      code: error instanceof DataAccessError ? error.code : undefined,
    });
  }

  if (!directory) {
    return (
      <Alert
        variant="error"
        className="mt-5"
      >
        The user directory could not be loaded. Check the server logs and the
        monitoring migration.
      </Alert>
    );
  }

  return (
    <>
      {invalidQuery ? (
        <Alert
          variant="info"
          className="mt-5"
        >
          The directory filters in the address were invalid, so the default view
          is shown.
        </Alert>
      ) : null}

      <DeveloperUserDirectory
        query={query}
        directory={directory}
      />
    </>
  );
}
