import type { Metadata } from "next";
import { Activity, AlertTriangle, Eye, Users } from "lucide-react";

import { DeveloperAccessDenied } from "@/components/developer/developer-access-denied";
import { DeveloperMetricCard } from "@/components/developer/developer-metric-card";
import { Alert } from "@/components/ui/alert";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import {
  getExternalMonitoringStatus,
  getPostHogSummary,
  getSentrySummary,
} from "@/lib/observability/external-monitoring";

export const metadata: Metadata = {
  title: "Monitoring",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const access = await requireDeveloperPageAccess("/developer/monitoring");

  if (access.status !== "allowed") {
    return (
      <DeveloperAccessDenied
        status={access.status === "unconfigured" ? "unconfigured" : "denied"}
      />
    );
  }

  const status = getExternalMonitoringStatus();
  const [sentry, postHog] = await Promise.all([
    getSentrySummary(),
    getPostHogSummary(),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="border-border border-b pb-5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Monitoring
        </h2>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          Errors from Sentry and analytics from PostHog, in one place. Data is
          cached 60 seconds; sources fail open when unconfigured.
        </p>
      </header>

      {!status.sentryConfigured || !status.postHogConfigured ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          {!status.sentryConfigured
            ? "Sentry query is not configured (SENTRY_API_TOKEN / SENTRY_ORG / SENTRY_PROJECT). "
            : ""}
          {!status.postHogConfigured
            ? "PostHog query is not configured (POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID)."
            : ""}
        </Alert>
      ) : null}

      <section
        aria-label="Sentry errors"
        className="mt-6"
      >
        <h3 className="text-base font-semibold">Errors (Sentry)</h3>
        {sentry ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <DeveloperMetricCard
                label="Open issues · 14 days"
                value={sentry.totalIssues}
                hint="Unresolved issues in the startask project."
                icon={AlertTriangle}
              />
              <DeveloperMetricCard
                label="Top issue events"
                value={sentry.issues[0]?.count ?? 0}
                hint={sentry.issues[0]?.title ?? "No issues."}
                icon={Activity}
              />
            </div>
            <ul className="mt-4 space-y-2">
              {sentry.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{issue.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {issue.count.toLocaleString()} events ·{" "}
                      {issue.userCount.toLocaleString()} users · {issue.level}
                    </p>
                  </div>
                  {issue.permalink ? (
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent shrink-0 font-medium underline underline-offset-2"
                    >
                      Sentry
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No Sentry data available.
          </p>
        )}
      </section>

      <section
        aria-label="PostHog analytics"
        className="mt-8"
      >
        <h3 className="text-base font-semibold">Analytics (PostHog)</h3>
        {postHog ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <DeveloperMetricCard
              label="Pageviews · recent"
              value={postHog.pageviews}
              hint="From the latest 100 events."
              icon={Eye}
            />
            <DeveloperMetricCard
              label="Unique users · recent"
              value={postHog.uniqueUsers}
              hint="Distinct users in the latest events."
              icon={Users}
            />
            <DeveloperMetricCard
              label="Events sampled"
              value={postHog.recentEvents}
              hint="Latest event window, refreshed every 60 seconds."
              icon={Activity}
            />
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No PostHog data available.
          </p>
        )}
      </section>
    </div>
  );
}
