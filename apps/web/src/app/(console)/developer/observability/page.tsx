import type { Metadata } from "next";

import { DeveloperAccessDenied } from "@/components/developer/developer-access-denied";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { getObservabilityViews, getUnpamSyncStatus } from "@/lib/db/plugins";
import type { Database } from "@/types/database";

type DualWriteDriftRow = Database["public"]["Views"]["dual_write_drift"]["Row"];
type NimDriftRow = Database["public"]["Views"]["nim_drift"]["Row"];
type TenantGapRow =
  Database["public"]["Views"]["observability_tenant_gap"]["Row"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function toDualWriteDrift(value: unknown): DualWriteDriftRow | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    legacy_members:
      typeof record.legacy_members === "number" ? record.legacy_members : null,
    new_memberships:
      typeof record.new_memberships === "number"
        ? record.new_memberships
        : null,
    legacy_without_new:
      typeof record.legacy_without_new === "number"
        ? record.legacy_without_new
        : null,
  };
}

function toNimDrift(value: unknown): NimDriftRow | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    identities_total:
      typeof record.identities_total === "number"
        ? record.identities_total
        : null,
    prefixed: typeof record.prefixed === "number" ? record.prefixed : null,
    unprefixed:
      typeof record.unprefixed === "number" ? record.unprefixed : null,
  };
}

function toTenantGapRows(rows: unknown[]): TenantGapRow[] {
  return rows.flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];

    return [
      {
        source: typeof record.source === "string" ? record.source : null,
        null_university_rows:
          typeof record.null_university_rows === "number"
            ? record.null_university_rows
            : null,
      },
    ];
  });
}

export const metadata: Metadata = {
  title: "Observability",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const access = await requireDeveloperPageAccess("/developer/observability");

  if (access.status !== "allowed") {
    return (
      <DeveloperAccessDenied
        status={access.status === "unconfigured" ? "unconfigured" : "denied"}
      />
    );
  }

  const [views, sync] = await Promise.all([
    getObservabilityViews(),
    getUnpamSyncStatus(),
  ]);

  const drift = toDualWriteDrift(views.drift);
  const nim = toNimDrift(views.nim);
  const gap = toTenantGapRows(views.gap);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="border-border border-b pb-5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Observability
        </h2>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          Tenant gaps, dual-write drift, NIM drift, and plugin sync status.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dual-write drift</CardTitle>
          </CardHeader>
          <p className="text-sm">
            Legacy: {drift?.legacy_members ?? "-"} • Baru:{" "}
            {drift?.new_memberships ?? "-"} • Tanpa mirror:{" "}
            {drift?.legacy_without_new ?? "-"}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>NIM drift</CardTitle>
          </CardHeader>
          <p className="text-sm">
            Total: {nim?.identities_total ?? "-"} • Prefixed:{" "}
            {nim?.prefixed ?? "-"} • Unprefixed: {nim?.unprefixed ?? "-"}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant gap</CardTitle>
          </CardHeader>
          {gap.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tenant gaps.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {gap.map((row) => (
                <li key={row.source ?? "unknown"}>
                  {row.source ?? "unknown"}: {row.null_university_rows ?? 0}{" "}
                  NULL
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plugin sync (UNPAM)</CardTitle>
          </CardHeader>
          <p className="text-sm">
            Last: {sync?.last_success_at ?? sync?.last_attempt_at ?? "belum"} •{" "}
            {sync?.event_count ?? 0} event
            {sync?.last_error ? ` • Error: ${sync.last_error}` : ""}
          </p>
        </Card>
      </div>
    </div>
  );
}
