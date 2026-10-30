import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  FileText,
  LogIn,
  Users,
  UserPlus,
} from "lucide-react";

import { DeveloperAccessDenied } from "@/components/developer/developer-access-denied";
import {
  DeveloperApplicationActivity,
  DeveloperAuthActivity,
} from "@/components/developer/developer-activity";
import { DeveloperHealthPanel } from "@/components/developer/developer-health";
import { DeveloperMetricCard } from "@/components/developer/developer-metric-card";
import { Alert } from "@/components/ui/alert";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import { DataAccessError } from "@/lib/db/assignments";
import {
  getDeveloperHealth,
  getDeveloperMetrics,
  listRecentApplicationActivity,
  listRecentAuthEvents,
  listRecentRegistrations,
  type DeveloperActivityItem,
  type DeveloperAuthEvent,
  type DeveloperHealth,
  type DeveloperMetrics,
  type DeveloperRegistration,
} from "@/lib/db/developer";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Developer monitoring",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type DashboardData = {
  metrics: DeveloperMetrics;
  health: DeveloperHealth;
  authEvents: DeveloperAuthEvent[];
  registrations: DeveloperRegistration[];
  activity: DeveloperActivityItem[];
};

export default async function DeveloperPage() {
  const access = await requireDeveloperPageAccess("/developer");

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
      <header className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Overview
          </h2>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            Real data from Supabase Auth and the application database. Access is
            restricted to the server-side developer allowlist and is independent
            of every application role. The per-account list lives under{" "}
            <Link
              href="/developer/users"
              className="text-accent font-medium underline underline-offset-2"
            >
              Users
            </Link>
            .
          </p>
        </div>
      </header>

      {!isServiceRoleConfigured() ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          The server-side monitoring data source is not configured. Metrics and
          health checks stay unavailable rather than falling back to partial
          client data.
        </Alert>
      ) : (
        <DashboardBody />
      )}

      <p className="text-muted-foreground mt-8 max-w-3xl text-xs leading-relaxed">
        Sign-in counts only include callbacks recorded after this feature was
        deployed; Supabase Auth keeps just the latest sign-in timestamp per
        account. Error rows capture sanitized server failures only. Emails and
        NIM are personal data: they are not shown here and are never written to
        monitoring tables, along with document contents, tokens, and
        credentials.
      </p>
    </div>
  );
}

async function DashboardBody() {
  let data: DashboardData | null = null;

  try {
    const [metrics, health, authEvents, registrations, activity] =
      await Promise.all([
        getDeveloperMetrics(),
        getDeveloperHealth(),
        listRecentAuthEvents(),
        listRecentRegistrations(),
        listRecentApplicationActivity(),
      ]);

    data = { metrics, health, authEvents, registrations, activity };
  } catch (error) {
    console.error("[developer] dashboard load failed", {
      name: error instanceof Error ? error.name : "unknown",
      code: error instanceof DataAccessError ? error.code : undefined,
    });
  }

  if (!data) {
    return (
      <Alert
        variant="error"
        className="mt-5"
      >
        Monitoring data could not be loaded. The dashboard stays empty instead
        of showing estimated values. Check the server logs and the monitoring
        migration.
      </Alert>
    );
  }

  return (
    <>
      <section
        aria-label="Developer metrics"
        className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <DeveloperMetricCard
          label="Total users"
          value={data.metrics.totalUsers}
          hint="Every account in Supabase Auth."
          icon={Users}
        />
        <DeveloperMetricCard
          label="Registrations · 30 days"
          value={data.metrics.registrations30}
          hint={`${data.metrics.registrations7.toLocaleString()} in the last 7 days.`}
          icon={UserPlus}
        />
        <DeveloperMetricCard
          label="Successful sign-ins · 30 days"
          value={data.metrics.signIns30}
          hint={`${data.metrics.signIns7.toLocaleString()} in the last 7 days, recorded since deployment.`}
          icon={LogIn}
        />
        <DeveloperMetricCard
          label="Unique active users · 30 days"
          value={data.metrics.activeUsers30}
          hint={`${data.metrics.activeUsers7.toLocaleString()} in the last 7 days.`}
          icon={Activity}
        />
        <DeveloperMetricCard
          label="Assignments"
          value={data.metrics.totalAssignments}
          hint="All assignments, all statuses."
          icon={FileText}
        />
        <DeveloperMetricCard
          label="Auth failures · 24 hours"
          value={data.health.authFailuresLast24h}
          hint="Recorded callback failures, not every rejected password."
          icon={AlertTriangle}
        />
      </section>

      <div className="mt-6">
        <DeveloperHealthPanel health={data.health} />
      </div>

      <div className="mt-6">
        <DeveloperAuthActivity
          events={data.authEvents}
          registrations={data.registrations}
        />
      </div>

      <DeveloperApplicationActivity items={data.activity} />
    </>
  );
}
