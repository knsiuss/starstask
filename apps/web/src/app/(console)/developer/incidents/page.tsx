import type { Metadata } from "next";
import Link from "next/link";

import {
  DEVELOPER_INCIDENT_STATUSES,
  DEVELOPER_INCIDENT_STATUS_LABELS,
  type IncidentStatusFilter,
} from "@starstask/contracts";

import { DeveloperIncidentConsole } from "@/components/developer/developer-incident-console";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { listDeveloperIncidents } from "@/lib/db/developer-operations";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer console · Incidents",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_FILTERS: IncidentStatusFilter[] = [
  "all",
  ...DEVELOPER_INCIDENT_STATUSES,
];

type IncidentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseStatusFilter(
  value: string | string[] | undefined,
): IncidentStatusFilter {
  const status = Array.isArray(value) ? value[0] : value;

  return STATUS_FILTERS.includes(status as IncidentStatusFilter)
    ? (status as IncidentStatusFilter)
    : "all";
}

export default async function DeveloperIncidentsPage({
  searchParams,
}: IncidentsPageProps) {
  await requireDeveloperPageAccess("/developer/incidents");

  const statusFilter = parseStatusFilter((await searchParams).status);

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Incident management"
        description="Track operational incidents with severity, status, and investigation notes. Status changes and notes are attributed to the signed-in developer account; deletion is intentionally not available."
      />

      <nav
        aria-label="Incident status filter"
        className="mt-5 flex flex-wrap gap-1.5"
      >
        {STATUS_FILTERS.map((filter) => {
          const active = filter === statusFilter;
          const label =
            filter === "all" ? "All" : DEVELOPER_INCIDENT_STATUS_LABELS[filter];

          return (
            <Link
              key={filter}
              href={
                filter === "all"
                  ? "/developer/incidents"
                  : `/developer/incidents?status=${filter}`
              }
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "bg-accent text-accent-foreground rounded-full px-3.5 py-1.5 text-sm font-medium"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {!isServiceRoleConfigured() ? (
        <div className="border-border bg-surface mt-5 rounded-xl border px-4 py-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
            The monitoring data source is not configured, so incidents cannot be
            read or written.
          </p>
        </div>
      ) : (
        <IncidentsBody statusFilter={statusFilter} />
      )}
    </div>
  );
}

async function IncidentsBody({
  statusFilter,
}: {
  statusFilter: IncidentStatusFilter;
}) {
  let incidents;
  let failed = false;

  try {
    incidents = await listDeveloperIncidents(statusFilter);
  } catch {
    failed = true;
  }

  if (failed || !incidents) {
    return (
      <div className="border-border bg-surface border-border mt-5 rounded-xl border px-4 py-6">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Incidents could not be loaded. Check that the developer operations
          migration has been applied, then reload this page.
        </p>
      </div>
    );
  }

  return <DeveloperIncidentConsole incidents={incidents} />;
}
