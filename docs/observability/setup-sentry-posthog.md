# Sentry + PostHog setup (free tier) — 2026-11-05

Code already inert without DSN/key. No paid plan needed.

## Sentry (error tracking, free 5k events/mo)

1. Create project at sentry.io (free)
2. Copy DSN -> Vercel env `NEXT_PUBLIC_SENTRY_DSN` (production)
3. Optional sourcemap: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` in CI only
4. Verify: trigger error in preview, check Sentry dashboard
5. PII: sendDefaultPii off in code, Replay/Feedback disabled

## PostHog (analytics, free 1M events/mo)

1. Create project at posthog.com
2. Copy key -> `NEXT_PUBLIC_POSTHOG_KEY`, host default US (or EU)
3. Verify: pageview pathname only, no autocapture/session recording (off in code)

## Observability views (DB, live 2026-11-05)

- `audit_logs_university_gap` — NULL tenant per day (35 historical left unmapped by design)
- `dual_write_drift` — legacy vs new membership counts
- `nim_drift` — prefixed vs unprefixed identities
- `observability_tenant_gap` — combined NULL counts
- `plugin_sync_status` — last cron sync per plugin

## Alerts (manual, free)

- Check `plugin_sync_status.last_error` daily
- Check Vercel deployment errors + Sentry issues weekly
- No paid monitoring needed for pilot scale
