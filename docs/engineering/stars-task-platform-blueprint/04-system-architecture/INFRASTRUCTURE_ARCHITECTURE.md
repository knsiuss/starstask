# Infrastructure Architecture

- Hosting: Vercel Hobby (`vercel.json` 2 crons verified) — preferred; alternative Cloudflare Pages/Workers evaluated but not recommended (Next.js features, DX).
- DB: Supabase Free Postgres (shared schema). Self-hosted Postgres rejected for now (operational cost; violates IDR 0 unless hardware already owned).
- Cache: Upstash Redis (existing).
- Storage: Supabase Storage now; Cloudflare R2 proposed (Phase 4).
- CDN/DNS: Cloudflare Free (proposed, Phase 1) in front of Vercel.
- CI/CD: GitHub Actions (proposed, Phase 0) — lint/typecheck/test/build on PR; no paid runners required.
- Monitoring: UptimeRobot free (proposed, Phase 0); Sentry/PostHog free tiers optional when needed.

Related: README.md · diagrams/07-deployment-infrastructure.mmd
