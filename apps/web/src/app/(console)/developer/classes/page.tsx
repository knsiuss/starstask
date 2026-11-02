import type { Metadata } from "next";

import { formatDate } from "@starstask/shared";

import { DeveloperAccessDenied } from "@/components/developer/developer-access-denied";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { DataAccessError } from "@/lib/db/assignments";
import {
  listDeveloperClassMetrics,
  type DeveloperClassMetric,
} from "@/lib/db/developer";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer console · Classes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  draft: "neutral",
  active: "success",
  archived: "warning",
} as const;

export default async function DeveloperClassesPage() {
  const access = await requireDeveloperPageAccess("/developer/classes");

  // The layout renders the denial, but this page re-checks independently and
  // never starts a service-role read for a caller who is not allowlisted.
  if (access.status !== "allowed") {
    return (
      <DeveloperAccessDenied
        status={access.status === "unconfigured" ? "unconfigured" : "denied"}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Classes"
        description="Aggregate per-class activity. Counts only: no member names, emails, student IDs, leave details, evidence, or coordinates are selected."
      />

      {!isServiceRoleConfigured() ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          The server-side monitoring data source is not configured. Class
          metrics stay unavailable rather than falling back to partial client
          data.
        </Alert>
      ) : (
        <ClassesBody />
      )}
    </div>
  );
}

async function ClassesBody() {
  let metrics: DeveloperClassMetric[] | null = null;

  try {
    metrics = await listDeveloperClassMetrics();
  } catch (error) {
    console.error("[developer] class metrics load failed", {
      name: error instanceof Error ? error.name : "unknown",
      code: error instanceof DataAccessError ? error.code : undefined,
    });
  }

  if (!metrics) {
    return (
      <Alert
        variant="error"
        className="mt-5"
      >
        Class metrics could not be loaded. The table stays empty instead of
        showing estimated values. Check the server logs and the monitoring
        migration.
      </Alert>
    );
  }

  if (metrics.length === 0) {
    return (
      <Alert
        variant="info"
        className="mt-5"
      >
        No classes exist yet. Metrics appear after the first class is approved.
      </Alert>
    );
  }

  return (
    <div className="border-border bg-surface mt-6 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[980px] text-left text-sm">
        <caption className="sr-only">
          Aggregate activity for every class, newest activity first by member
          count. No personal data is included.
        </caption>
        <thead className="bg-subtle text-muted-foreground text-xs uppercase">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 font-medium"
            >
              Class
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium"
            >
              Period
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium"
            >
              Members
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium"
            >
              Content
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium"
            >
              Attendance
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium"
            >
              Leave
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium"
            >
              Invites
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium"
            >
              Last activity
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {metrics.map((metric) => (
            <tr key={metric.classId}>
              <td className="px-4 py-3">
                <p className="text-foreground font-medium">{metric.name}</p>
                <p className="text-muted-foreground text-xs">
                  {metric.classCode ?? "No class code"}
                </p>
              </td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[metric.status]}>
                  {metric.status}
                </Badge>
              </td>
              <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                {metric.academicYear} · {metric.semester}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {metric.memberCount}
                <span className="text-muted-foreground text-xs">
                  {" "}
                  / {metric.adminCount} admin
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {metric.publishedCount}
                <span className="text-muted-foreground text-xs">
                  {" "}
                  / {metric.pendingReviewCount} pending
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {metric.sessionCount}
                <span className="text-muted-foreground text-xs">
                  {" "}
                  / {metric.attendanceCount} records
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {metric.leaveRequestCount}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {metric.invitationCount}
              </td>
              <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                {formatDate(metric.lastActivityAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
