# Observability Strategy

Free-tier-first: UptimeRobot (uptime), Vercel Analytics/Web Vitals (LCP/INP/CLS), Sentry free (errors), optional PostHog free (product analytics), plus `pg_stat_statements` (DB) and structured server logs with correlation IDs (74 error-site TODOs in repo show logging is patchy — normalize).

Tenant-level metrics (Phase 5+): requests per university, storage per tenant, error rate per tenant, slow endpoints per tenant (tenant id from server context, never client param).

Error surfacing: keep generic user errors; internal ids stay server-side.

Related: README.md · PERFORMANCE_BENCHMARK_PLAN.md
