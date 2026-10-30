import "server-only";

import { parseDeveloperEmails } from "@starstask/shared";

import { isSupabaseConfigured } from "@/lib/env/public";
import { probeDeveloperStorage } from "@/lib/db/developer-operations";

/**
 * Configuration presence checks for /developer/integrations.
 *
 * Every check answers only "is this configured / reachable" — never what the
 * value is. No environment value, secret, URL, or key material leaves the
 * server through this module.
 */

export type IntegrationCheck = {
  id: string;
  label: string;
  /** What the check inspects, phrased so it can be shown to the developer. */
  description: string;
  ok: boolean;
  kind: "configured" | "reachable" | "probe";
};

function hasEnv(...names: string[]): boolean {
  return names.every((name) => {
    const value = process.env[name];

    return typeof value === "string" && value.trim().length > 0;
  });
}

export type DeveloperIntegrationStatus = {
  checks: IntegrationCheck[];
  allConfigured: boolean;
};

export async function getDeveloperIntegrationStatus(): Promise<DeveloperIntegrationStatus> {
  const supabaseConfigured = isSupabaseConfigured();
  const serviceRoleConfigured = hasEnv("SUPABASE_SERVICE_ROLE_KEY");

  const checks: IntegrationCheck[] = [
    {
      id: "supabase-client",
      label: "Supabase client",
      description:
        "Project URL and publishable key for browser and SSR clients.",
      ok: supabaseConfigured,
      kind: "configured",
    },
    {
      id: "supabase-service-role",
      label: "Supabase service role",
      description:
        "Server-only key used by admin APIs and the developer console.",
      ok: serviceRoleConfigured,
      kind: "configured",
    },
    {
      id: "developer-allowlist",
      label: "Developer allowlist",
      description: "DEVELOPER_EMAILS parses and grants console access.",
      ok: parseDeveloperEmails(process.env.DEVELOPER_EMAILS).status === "ok",
      kind: "configured",
    },
    {
      id: "rate-limit",
      label: "Rate limiting (Upstash Redis)",
      description: "REST URL, REST token, and the rate-limit salt.",
      ok: hasEnv(
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "RATE_LIMIT_SALT",
      ),
      kind: "configured",
    },
    {
      id: "web-push",
      label: "Web Push (VAPID)",
      description:
        "VAPID public key, private key, and subject for push notifications.",
      ok: hasEnv("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"),
      kind: "configured",
    },
    {
      id: "google-calendar",
      label: "Google Calendar integration",
      description:
        "OAuth client ID, secret, redirect URI, and token encryption key.",
      ok: hasEnv(
        "GOOGLE_CALENDAR_CLIENT_ID",
        "GOOGLE_CALENDAR_CLIENT_SECRET",
        "GOOGLE_CALENDAR_REDIRECT_URI",
        "GOOGLE_TOKEN_ENCRYPTION_KEY",
      ),
      kind: "configured",
    },
    {
      id: "cron",
      label: "Cron endpoints",
      description: "CRON_SECRET that protects scheduled job routes.",
      ok: hasEnv("CRON_SECRET"),
      kind: "configured",
    },
    {
      id: "site-url",
      label: "Public site URL",
      description: "NEXT_PUBLIC_SITE_URL used to build absolute links.",
      ok: hasEnv("NEXT_PUBLIC_SITE_URL"),
      kind: "configured",
    },
  ];

  let storageOk = false;

  // The storage probe only runs when Supabase itself is reachable, so an
  // unconfigured deployment reports configuration issues instead of a
  // misleading "storage unreachable" row.
  if (supabaseConfigured && serviceRoleConfigured) {
    try {
      storageOk = (await probeDeveloperStorage()).ok;
    } catch {
      storageOk = false;
    }
  }

  checks.push({
    id: "storage",
    label: "Object storage",
    description: "Attachment bucket metadata lookup through the service role.",
    ok: storageOk,
    kind: "probe",
  });

  return {
    checks,
    allConfigured: checks.every((check) => check.ok),
  };
}
