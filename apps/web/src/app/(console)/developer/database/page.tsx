import type { Metadata } from "next";

import { formatDate } from "@starstask/shared";

import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import {
  getDeveloperAppliedMigrations,
  getDeveloperDatabaseDetails,
  type DeveloperDatabaseDetails,
  type DeveloperMigrations,
} from "@/lib/db/developer-operations";
import { getDeveloperHealth } from "@/lib/db/developer";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer console · Database",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MAX_LISTED_MIGRATIONS = 50;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = "B";

  for (const next of units) {
    if (value < 1024) {
      break;
    }

    value = value / 1024;
    unit = next;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {hint}
      </p>
    </div>
  );
}

export default async function DeveloperDatabasePage() {
  await requireDeveloperPageAccess("/developer/database");

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Database & migrations"
        description="Connectivity, connection usage, owned-table sizes, and the applied Supabase CLI migration list. Counts that the service role cannot observe are shown as unavailable rather than zero."
      />

      {!isServiceRoleConfigured() ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          The monitoring data source is not configured, so database checks are
          unavailable.
        </Alert>
      ) : (
        <DatabaseBody />
      )}
    </div>
  );
}

async function DatabaseBody() {
  let details: DeveloperDatabaseDetails | null = null;
  let migrations: DeveloperMigrations | null = null;
  let health: Awaited<ReturnType<typeof getDeveloperHealth>> | null = null;
  let failed = false;

  try {
    [details, migrations, health] = await Promise.all([
      getDeveloperDatabaseDetails(),
      getDeveloperAppliedMigrations(),
      getDeveloperHealth(),
    ]);
  } catch {
    failed = true;
  }

  if (failed || !details || !migrations || !health) {
    return (
      <Alert
        variant="error"
        className="mt-5"
      >
        Database details could not be loaded. The page stays empty instead of
        showing estimated values. Check the server logs and that the developer
        operations migration has been applied.
      </Alert>
    );
  }

  const connections = details.connections;

  return (
    <>
      <section
        aria-label="Connectivity"
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricTile
          label="Database connectivity"
          value={health.database.ok ? "Reachable" : "Unavailable"}
          hint={
            health.database.latencyMs !== null
              ? `Read probe latency ${health.database.latencyMs} ms.`
              : "Latency was not recorded for this probe."
          }
        />
        <MetricTile
          label="Connection usage"
          value={
            connections?.total !== null && connections?.total !== undefined
              ? `${connections.total.toLocaleString()} / ${
                  connections.maxConnections !== null
                    ? connections.maxConnections.toLocaleString()
                    : "?"
                }`
              : "Unavailable"
          }
          hint={
            connections?.total !== null && connections?.total !== undefined
              ? `${(connections.active ?? 0).toLocaleString()} active · ${(
                  connections.idle ?? 0
                ).toLocaleString()} idle across visible backends.`
              : "Connection counts are not visible to this role."
          }
        />
        <MetricTile
          label="Migration status"
          value={
            migrations.available
              ? `${migrations.migrations.length.toLocaleString()} applied`
              : "Not available"
          }
          hint={
            migrations.available
              ? "Read from the Supabase CLI migration history."
              : "The Supabase CLI migration table is absent or unreadable from this role."
          }
        />
      </section>

      <section
        aria-labelledby="table-sizes"
        className="border-border bg-surface mt-6 rounded-xl border"
      >
        <div className="border-border border-b px-4 py-3">
          <h3
            id="table-sizes"
            className="text-sm font-semibold tracking-tight"
          >
            Owned table sizes
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Total relation size including indexes and TOAST. Tables that do not
            exist in this deployment are omitted.
          </p>
        </div>

        {details.tableSizes.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">
            Table sizes could not be read for any owned table.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {details.tableSizes.map((entry) => (
              <li
                key={entry.table}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="font-mono text-sm">{entry.table}</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {formatBytes(entry.bytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="applied-migrations"
        className="border-border bg-surface mt-6 rounded-xl border"
      >
        <div className="border-border border-b px-4 py-3">
          <h3
            id="applied-migrations"
            className="text-sm font-semibold tracking-tight"
          >
            Applied migrations
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Newest first, capped at the {MAX_LISTED_MIGRATIONS} most recent.
            This is a read-only view; running migrations stays a Supabase CLI
            operation and is intentionally not exposed here.
          </p>
        </div>

        {!migrations.available ? (
          <p className="text-muted-foreground px-4 py-6 text-sm leading-relaxed">
            The migration history table is not available to this deployment.
            Projects not managed by the Supabase CLI do not maintain it, and
            this page reports that honestly instead of guessing.
          </p>
        ) : migrations.migrations.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">
            No migrations are recorded in the history table.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {migrations.migrations
              .slice(0, MAX_LISTED_MIGRATIONS)
              .map((migration) => (
                <li
                  key={migration.version}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {migration.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {migration.version}
                    </p>
                  </div>
                  <time
                    dateTime={migration.appliedAt}
                    className="text-muted-foreground shrink-0 text-xs"
                  >
                    {formatDate(migration.appliedAt)}
                  </time>
                </li>
              ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground mt-6 max-w-3xl text-xs leading-relaxed">
        Connection counts cover the backends visible to this role through
        pg_stat_activity and may be lower than the true pool total. No query
        text, user data, or credentials are read or displayed on this page.
      </p>
    </>
  );
}
