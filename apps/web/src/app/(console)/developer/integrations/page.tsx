import type { Metadata } from "next";

import { formatDate } from "@starstask/shared";

import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireDeveloperPageAccess } from "@/lib/auth/developer";
import {
  getDeveloperIntegrationStatus,
  type IntegrationCheck,
} from "@/lib/observability/integration-status";

export const metadata: Metadata = {
  title: "Developer console · Integrations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function CheckRow({ check }: { check: IntegrationCheck }) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {check.description}
        </p>
      </div>
      <Badge variant={check.ok ? "success" : "warning"}>
        {check.ok
          ? check.kind === "probe"
            ? "Reachable"
            : "Configured"
          : check.kind === "probe"
            ? "Unreachable"
            : "Not configured"}
      </Badge>
    </li>
  );
}

export default async function DeveloperIntegrationsPage() {
  await requireDeveloperPageAccess("/developer/integrations");

  let status;
  let failed = false;

  try {
    status = await getDeveloperIntegrationStatus();
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <DeveloperPageHeader
        title="Configuration & integrations"
        description="Whether each runtime integration is configured and whether the storage bucket is reachable. This page validates presence and reachability only — it never displays environment values, keys, or URLs."
      />

      {failed || !status ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          Integration status could not be evaluated. Check the server logs.
        </Alert>
      ) : (
        <>
          {!status.allConfigured ? (
            <Alert
              variant="warning"
              className="mt-5"
            >
              One or more integrations are missing configuration. Features that
              depend on them fail closed; this page intentionally does not
              reveal which value is absent.
            </Alert>
          ) : null}

          <section
            aria-label="Integration checks"
            className="border-border bg-surface mt-5 rounded-xl border"
          >
            <div className="border-border border-b px-4 py-3">
              <h3 className="text-sm font-semibold tracking-tight">
                Runtime configuration
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Checked on the server at page render; values are never echoed
                back.
              </p>
            </div>

            <ul className="divide-border divide-y">
              {status.checks.map((check) => (
                <CheckRow
                  key={check.id}
                  check={check}
                />
              ))}
            </ul>
          </section>

          <p className="text-muted-foreground mt-6 max-w-3xl text-xs leading-relaxed">
            Status evaluated at {formatDate(new Date().toISOString())}. Changing
            environment variables requires a redeploy or restart; this page
            reflects the running process only. OAuth sign-in runs through
            Supabase Auth, so its configuration is covered by the Supabase
            checks.
          </p>
        </>
      )}
    </div>
  );
}
