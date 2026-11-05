# Free Tier Comparison

- Hosting: Vercel Hobby preferred over Cloudflare Pages/Workers for Next.js (DX, feature fit); R2 for bytes regardless of host.
- Database: Supabase Free Postgres preferred over self-hosted (op cost); Aurora Neon/RDS free tiers not recommended (managerial overhead at IDR 0 goal).
- Cache: Upstash Redis over self-hosted Redis (no always-on box).
- Storage: R2 over Supabase Storage once Phase 4 lands (free egress); S3 Standard paid not justified; MinIO self-host violates IDR 0 → DO NOT USE.
- Observability: UptimeRobot + Vercel Analytics + optional Sentry/PostHog free tiers over Datadog/paid APM.
- Email: Resend free tier optional; keep existing in-app/post notifications as primary.

Related: README.md · FREE_TIER_RESOURCE_INVENTORY.md
