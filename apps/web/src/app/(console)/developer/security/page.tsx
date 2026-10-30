import type { Metadata } from "next";

import {
  DEVELOPER_SECURITY_SOURCES,
  DEVELOPER_SECURITY_SOURCE_LABELS,
  developerSecurityQuerySchema,
  type DeveloperSecurityQuery,
  type DeveloperSecuritySource,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { DeveloperPager } from "@/components/developer/developer-pager";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { DataAccessError } from "@/lib/db/assignments";
import { listDeveloperSecurityEvents } from "@/lib/db/developer-operations";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer console · Security",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEFAULT_QUERY: DeveloperSecurityQuery = {
  source: "audit",
  search: undefined,
  page: 1,
  pageSize: 25,
};

type SecurityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(query: DeveloperSecurityQuery, page: number): string {
  const params = new URLSearchParams();

  params.set("source", query.source);

  if (query.search) {
    params.set("search", query.search);
  }

  params.set("page", String(page));

  return `/developer/security?${params.toString()}`;
}

export default async function DeveloperSecurityPage({
  searchParams,
}: SecurityPageProps) {
  await requireDeveloperPageAccess("/developer/security");

  const params = await searchParams;
  const parsed = developerSecurityQuerySchema.safeParse({
    source: firstValue(params.source),
    search: firstValue(params.search),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });
  const query = parsed.success ? parsed.data : DEFAULT_QUERY;

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Security & audit logs"
        description="The app-wide audit trail (class, role, application, leave, and moderation changes recorded by database functions) alongside server-recorded sign-in outcomes. Rows never contain emails, tokens, IP addresses, or document contents."
      />

      {!isServiceRoleConfigured() ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          The monitoring data source is not configured, so no audit or auth
          events are available.
        </Alert>
      ) : (
        <SecurityBody query={query} />
      )}
    </div>
  );
}

async function SecurityBody({ query }: { query: DeveloperSecurityQuery }) {
  let result;
  let loadError: DataAccessError | null = null;

  try {
    result = await listDeveloperSecurityEvents(query);
  } catch (error) {
    loadError =
      error instanceof DataAccessError
        ? error
        : new DataAccessError("Could not load security events", "unknown");
  }

  if (loadError || !result) {
    return (
      <Alert
        variant="error"
        className="mt-5"
      >
        Security events could not be loaded. The page stays empty instead of
        showing estimated values. Check the server logs and the monitoring
        migration.
      </Alert>
    );
  }

  return (
    <section
      aria-label="Security events"
      className="border-border bg-surface mt-5 rounded-xl border"
    >
      <form
        action="/developer/security"
        method="get"
        className="border-border flex flex-wrap items-end gap-3 border-b px-4 py-4"
      >
        <div className="w-52">
          <Label htmlFor="security-source">Event stream</Label>
          <Select
            id="security-source"
            name="source"
            defaultValue={query.source}
            className="mt-1.5"
          >
            {DEVELOPER_SECURITY_SOURCES.map(
              (source: DeveloperSecuritySource) => (
                <option
                  key={source}
                  value={source}
                >
                  {DEVELOPER_SECURITY_SOURCE_LABELS[source]}
                </option>
              ),
            )}
          </Select>
        </div>

        <div className="min-w-56 flex-1">
          <Label htmlFor="security-search">
            {query.source === "audit"
              ? "Search action"
              : "Search reason or provider"}
          </Label>
          <Input
            id="security-search"
            name="search"
            type="search"
            defaultValue={query.search ?? ""}
            maxLength={100}
            placeholder={
              query.source === "audit"
                ? "e.g. role_assigned"
                : "e.g. exchange_failed"
            }
            className="mt-1.5"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
        >
          Apply filters
        </Button>
      </form>

      {result.items.length === 0 ? (
        <p className="text-muted-foreground px-4 py-8 text-sm leading-relaxed">
          No events match the current stream and filters. Sign-in outcomes are
          recorded only from deployment onward; the audit trail contains only
          changes that database functions already record.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {result.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium">
                  {item.kind}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {item.source === "audit"
                    ? `Entity: ${item.detail ?? "unspecified"}`
                    : item.detail
                      ? `Reason or provider: ${item.detail}`
                      : "No reason recorded"}
                </p>
                {item.actorId ? (
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                    actor {item.actorId}
                  </p>
                ) : null}
              </div>
              <time
                dateTime={item.createdAt}
                className="text-muted-foreground shrink-0 text-xs"
              >
                {formatDate(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <DeveloperPager
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(page) => buildHref(query, page)}
        itemLabel={`${result.total.toLocaleString()} events total`}
      />
    </section>
  );
}
