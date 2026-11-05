# Free Tier Resource Inventory

Classification per resource with verified quota **to be re-verified against official docs in Phase 0** (no pricing article reliance; this audit labels quotas as targets to confirm).

| Resource | Classification | Purpose | Free quota (verify) | Upgrade trigger |
|---|---|---|---|---|
| Vercel Hobby | USE NOW | Hosting | Bandwidth + build minutes caps | Bandwidth exceeded |
| Supabase Free | USE NOW | DB/Auth/RLS | 500 MB DB, 1 GB storage, 50k MAU | DB size/MAU caps |
| Upstash Redis | USE NOW | Rate limit/cache | 500k req/day sticky tier | Req exceeded |
| Cloudflare DNS/CDN | USE NOW | CDN/security | Unlimited proxy | — |
| GitHub Actions | USE NOW | CI | Free for public repos | Paid minutes |
| UptimeRobot | USE NOW | Uptime | 50 monitors | — |
| Cloudflare R2 | USE WHEN NEEDED | Object storage | 10 GB storage, 0 egress | >10 GB storage |
| Sentry free | OPTIONAL | Errors | 5k events/mo tier | — |
| PostHog free | OPTIONAL | Analytics | 1M events/mo | — |
| Resend free | OPTIONAL | Email | 3k emails/mo | — |
| k6 / Playwright | USE NOW (testing) | Load/e2e | local | — |

Related: README.md · FREE_TIER_COMPARISON.md
