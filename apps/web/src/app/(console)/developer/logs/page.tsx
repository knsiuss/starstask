import type { Metadata } from "next";

import {
  DEVELOPER_LOG_RANGE_LABELS,
  DEVELOPER_LOG_RANGES,
  developerLogsQuerySchema,
  type DeveloperLogRange,
  type DeveloperLogsQuery,
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
import { listDeveloperErrors } from "@/lib/db/developer-operations";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer console · Logs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEFAULT_QUERY: DeveloperLogsQuery = {
  range: "30d",
  search: undefined,
  page: 1,
  pageSize: 25,
};

type LogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(query: DeveloperLogsQuery, page: number): string {
  const params = new URLSearchParams();

  params.set("range", query.range);

  if (query.search) {
    params.set("search", query.search);
  }

  params.set("page", String(page));

  return `/developer/logs?${params.toString()}`;
}

export default async function DeveloperLogsPage({
  searchParams,
}: LogsPageProps) {
  await requireDeveloperPageAccess("/developer/logs");

  const params = await searchParams;
  const parsed = developerLogsQuerySchema.safeParse({
    range: firstValue(params.range),
    search: firstValue(params.search),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });
  const query = parsed.success ? parsed.data : DEFAULT_QUERY;

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Logs & error tracking"
        description="Sanitized server-error markers recorded by instrumentation and route handlers. Rows contain a route template, HTTP method, error identity, and digest only — never messages, stacks, headers, or request bodies."
      />

      {!isServiceRoleConfigured() ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          The monitoring data source is not configured, so no log entries are
          available.
        </Alert>
      ) : (
        <LogsBody query={query} />
      )}
    </div>
  );
}

async function LogsBody({ query }: { query: DeveloperLogsQuery }) {
  let result;
  let loadError: DataAccessError | null = null;

  try {
    result = await listDeveloperErrors(query);
  } catch (error) {
    loadError =
      error instanceof DataAccessError
        ? error
        : new DataAccessError("Could not load log entries", "unknown");
  }

  if (loadError || !result) {
    return (
      <Alert
        variant="error"
        className="mt-5"
      >
        Log entries could not be loaded. The page stays empty instead of showing
        estimated values. Check the server logs and the monitoring migration.
      </Alert>
    );
  }

  const hasFilters = query.range !== "30d" || Boolean(query.search);

  return (
    <section
      aria-label="Error log entries"
      className="border-border bg-surface mt-5 rounded-xl border"
    >
      <form
        action="/developer/logs"
        method="get"
        className="border-border flex flex-wrap items-end gap-3 border-b px-4 py-4"
      >
        <div className="w-44">
          <Label htmlFor="logs-range">Time range</Label>
          <Select
            id="logs-range"
            name="range"
            defaultValue={query.range}
            className="mt-1.5"
          >
            {DEVELOPER_LOG_RANGES.map((range: DeveloperLogRange) => (
              <option
                key={range}
                value={range}
              >
                {DEVELOPER_LOG_RANGE_LABELS[range]}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-56 flex-1">
          <Label htmlFor="logs-search">Search route or error name</Label>
          <Input
            id="logs-search"
            name="search"
            type="search"
            defaultValue={query.search ?? ""}
            maxLength={100}
            placeholder="e.g. assignments or TypeError"
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
          {hasFilters
            ? "No entries match the current filters."
            : "No server errors recorded in this window. Error capture starts when the monitoring feature is deployed; earlier errors live only in platform logs."}
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {result.items.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {entry.routePath ?? "Unattributed route"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {[entry.method, entry.errorName]
                    .filter((value): value is string => Boolean(value))
                    .join(" · ") || "No error identity"}
                </p>
                {entry.errorDigest ? (
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                    digest {entry.errorDigest}
                  </p>
                ) : null}
              </div>
              <time
                dateTime={entry.createdAt}
                className="text-muted-foreground shrink-0 text-xs"
              >
                {formatDate(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <DeveloperPager
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(page) => buildHref(query, page)}
        itemLabel={`${result.total.toLocaleString()} entries total`}
      />
    </section>
  );
}
