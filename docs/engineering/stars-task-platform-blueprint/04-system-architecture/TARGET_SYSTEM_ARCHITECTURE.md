# Target System Architecture

Layered view; **proposed** elements are labelled.

- **Presentation:** Next.js App Router; Server Components for data; client islands for interaction; Suspense streaming on dashboard/action center; skeleton states everywhere.
- **Application:** Supabase Auth (global identity); server tenant-context resolution (proposed per-request middleware); class/per-university authorization via `getClassRole`-style resolution; Zod boundary validation; thin route handlers.
- **Data:** PostgreSQL (shared schema, proposed `university_id` scoping); RLS; RPC aggregation (`get_class_dashboard_stats` proposed); indexes per §02 audit.
- **Performance:** Upstash Redis selective caching (tenant-keyed); CDN via Cloudflare; pagination standard.
- **Background:** Vercel crons + DB-backed job queue (proposed) for exports/OCR/notifications; cron = scheduler only.
- **Storage:** Cloudflare R2 (proposed) for bytes; Supabase Postgres for metadata; private buckets + signed URLs.
- **Observability:** Web Vitals + API latency + Sentry/PostHog free tiers (proposed), tenant-level metrics.
- **Infra:** Vercel Hobby hosting; Supabase Free; GitHub Actions CI (proposed).

Why not microservices: no evidence for split; single Next.js surface keeps IDR 0 cost; extract only if measured pain.

Related: README.md · diagrams/02-target-architecture.mmd
