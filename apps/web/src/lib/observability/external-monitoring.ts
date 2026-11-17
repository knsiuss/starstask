import "server-only";

import { getCached } from "@/lib/cache/redis-cache";

/**
 * Unified monitoring: reads from Sentry + PostHog REST APIs so the
 * developer console shows errors and analytics in one place.
 *
 * Each source is optional — without its token the fetch returns null and
 * the dashboard shows a "not configured" notice instead of failing.
 * Results are cached 60s so rendering the console never hammers the
 * third-party APIs. Failures always degrade to null, never throw state.
 */

const FETCH_TIMEOUT_MS = 3000;
const CACHE_TTL_SECONDS = 60;

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type SentryIssue = {
  id: string;
  title: string;
  level: string;
  count: number;
  userCount: number;
  lastSeen: string | null;
  permalink: string | null;
};

export type SentrySummary = {
  totalIssues: number;
  issues: SentryIssue[];
} | null;

export async function getSentrySummary(): Promise<SentrySummary> {
  const token = env("SENTRY_API_TOKEN");
  const org = env("SENTRY_ORG");
  const project = env("SENTRY_PROJECT");

  if (!token || !org || !project) {
    return null;
  }

  return getCached<SentrySummary>(
    `monitoring:sentry:${project}`,
    CACHE_TTL_SECONDS,
    async () => {
      const url = `https://sentry.io/api/0/organizations/${encodeURIComponent(org)}/issues/?project=${encodeURIComponent(project)}&statsPeriod=14d&sort=freq&limit=10`;
      const data = (await fetchJson(url, token)) as {
        count?: number;
        results?: {
          id?: string;
          title?: string;
          level?: string;
          count?: number;
          userCount?: number;
          lastSeen?: string;
          permalink?: string;
        }[];
      } | null;

      if (!data) {
        return null;
      }

      return {
        totalIssues: data.count ?? data.results?.length ?? 0,
        issues: (data.results ?? []).map((issue) => ({
          id: String(issue.id ?? ""),
          title: String(issue.title ?? "Unknown error"),
          level: String(issue.level ?? ""),
          count: Number(issue.count ?? 0),
          userCount: Number(issue.userCount ?? 0),
          lastSeen: issue.lastSeen ?? null,
          permalink: issue.permalink ?? null,
        })),
      };
    },
  );
}

export type PostHogSummary = {
  pageviews: number;
  uniqueUsers: number;
  recentEvents: number;
} | null;

export async function getPostHogSummary(): Promise<PostHogSummary> {
  const token = env("POSTHOG_PERSONAL_API_KEY");
  const projectId = env("POSTHOG_PROJECT_ID");

  if (!token || !projectId) {
    return null;
  }

  return getCached<PostHogSummary>(
    `monitoring:posthog:${projectId}`,
    CACHE_TTL_SECONDS,
    async () => {
      const host =
        env("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://us.i.posthog.com";
      const url = `${host}/api/projects/${encodeURIComponent(projectId)}/events/?limit=100`;
      const data = (await fetchJson(url, token)) as {
        results?: {
          event?: string;
          properties?: { $user_id?: string; $pathname?: string };
        }[];
      } | null;

      if (!data?.results) {
        return null;
      }

      const pageviews = data.results.filter(
        (event) => event.event === "$pageview",
      ).length;
      const uniqueUsers = new Set(
        data.results
          .map((event) => event.properties?.$user_id)
          .filter((id): id is string => Boolean(id)),
      ).size;

      return {
        pageviews,
        uniqueUsers,
        recentEvents: data.results.length,
      };
    },
  );
}

export type ExternalMonitoringStatus = {
  sentryConfigured: boolean;
  postHogConfigured: boolean;
};

export function getExternalMonitoringStatus(): ExternalMonitoringStatus {
  return {
    sentryConfigured: Boolean(
      env("SENTRY_API_TOKEN") && env("SENTRY_ORG") && env("SENTRY_PROJECT"),
    ),
    postHogConfigured: Boolean(
      env("POSTHOG_PERSONAL_API_KEY") && env("POSTHOG_PROJECT_ID"),
    ),
  };
}
