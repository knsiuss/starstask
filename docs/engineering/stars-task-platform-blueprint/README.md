# StarsTask — Platform Blueprint (Master Engineering Audit)

Purpose: read-only architecture, performance, and multi-university SaaS blueprint for StarsTask. Documentation only — no application code, migrations, RLS, dependencies, or deployment config were changed. Evidence paths below are repository paths relative to repo root unless stated otherwise.

## 1. Executive summary

StarsTask is a Next.js App Router monorepo (`apps/web`, `packages/contracts`, `packages/shared`, `supabase/`). It runs on Vercel + Supabase (Auth, PostgreSQL, RLS, Storage), with Upstash Redis for rate limiting, two Vercel crons, Google Calendar integration, web-push, and PDF/XLSX/OCR pipelines. It is functionally broad (dashboard, assignments, action center, attendance, leave, schedules, materials, notifications, admin, developer consoles) but performance-sensitive in aggregate: 78 pages, 113 API routes, 78 migrations, heavy document processing, and role/class-scoped authorization on nearly every request.

## 2. Current architecture summary

- Single Next.js app `apps/web` (Next 16.4.3, React 19.3.1, TypeScript 5.9.3) with Server Components by default; client components only where browser interaction is required.
- Data layer: Supabase Postgres with hand-maintained `apps/web/src/types/database.ts` + generated `database.generated.ts` + `database-contract.ts` drift check. Synchronous `supabase-js` via `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.118.0.
- API surface: 113 `route.ts` files under `apps/web/src/app/api/**`, plus server actions and `lib/db/*` query modules.
- Background: 2 Vercel crons in `apps/web/vercel.json` (`attendance-retention`, `notification-retention`), plus cron routes `deadline-reminders`, `notification-events`, `session-jobs` (route-level, scheduled by convention).
- Integrations: Google Calendar OAuth (`apps/web/src/app/api/integrations/google-calendar/**`), web-push (`/api/push/**`), Upstash Redis + Ratelimit, storage uploads, ExcelJS/JsZip/PDF-Lib/unpdf document pipelines.

See `01-discovery/CURRENT_ARCHITECTURE.md` and diagram `04-system-architecture/diagrams/01-current-architecture.mmd`.

## 3. Main performance bottlenecks (P0/P1)

1. **Sequential per-surface fetches in dashboards, Action Center, class pages** (`apps/web/src/app/(workspace)/dashboard/page.tsx`, `dashboard/actions/page.tsx`, `dashboard/classes/[slug]/page.tsx`, `lib/db/*`): multiple `Promise.all` in places, but also serial dependent fetches per class/assignment/leave surfaces.
2. **RLS-per-row overhead with nested class-membership checks** (`supabase/migrations/*`, `lib/db/*`): authorization is re-evaluated per row in policies and RPCs.
3. **Client list re-fetch and `router.refresh()` patterns** in attendance/leave/action features, raising TTFB and hydration cost.
4. **Synchronous heavy exports/OCR** (`apps/web/src/app/api/classes/[slug]/attendance/exports/**`, `/api/leave-requests/[id]/ocr/**`, `lib/ocr/schedule-parse.ts`, `exceljs`, `pdf-lib`, `unpdf`): in-request processing, no job queue yet.
5. **Storage bytes on Supabase Storage with signed URLs per file operation** rather than bulk-signed flows.

Full findings with IDs, evidence, and complexity in `02-performance/FULL_PLATFORM_PERFORMANCE_AUDIT.md`.

## 4. Multi-university architecture (recommended)

Shared database + shared schema with strict tenant ownership (`university_id` on tenant-scoped tables) plus tenant-aware RLS (`is_university_member()` / resolution function in policies) — **not** schema-per-tenant (operational complexity) and not database-per-tenant (cost). Auth identities stay global (Supabase Auth); *active university context* is resolved per request and stored in server session state. Full design in `03-multi-tenancy/MULTI_TENANT_ARCHITECTURE.md` and `TENANT_DATA_MODEL.md`.

## 5. Storage architecture

Recommended: Supabase PostgreSQL keeps metadata; **Cloudflare R2 stores bytes** (free egress, S3-compatible, private buckets, signed upload/download URLs issued by trusted server routes). Supabase Storage remains only if R2 integration slips; never embed DB architecture to work around R2 limits. Upload/download flow: `04-system-architecture/diagrams/10-cloudflare-r2-upload-download.mmd`.

## 6. Free-tier resource strategy

First maximize existing Vercel Hobby + Supabase Free + Upstash Redis. Add when needed (no new paid infra): Cloudflare DNS/CDN + R2, GitHub Actions for CI, UptimeRobot for uptime, optional Sentry/PostHog free tiers. Classification, quotas, and upgrade triggers per resource in `05-resource-planning/FREE_TIER_RESOURCE_INVENTORY.md`. Additional monthly cost target: **IDR 0** while staying within verified free quotas; load-tested capacity envelope not claimed.

## 7. Critical security considerations

- Never weaken RLS for performance; optimize policies/membership functions instead.
- Tenant context must be server-resolved and never client-spoofable (signed server claims, URL/cookie/session binding, list+redirect flow, per-request membership proof).
- Storage paths and signed URLs must be tenant-namespaced; background jobs must re-verify tenant membership; caches must be tenant-keyed (or disabled across tenants).
- Class Admin authority is per-class/per-university only; no global-role assumptions.

See `03-multi-tenancy/TENANT_ISOLATION_SECURITY.md`.

## 8. Diagram index

All in `04-system-architecture/diagrams/` (`.mmd` editable Mermaid + embedded renderings):

1. `01-current-architecture.mmd` — verified AS-IS
2. `02-target-architecture.mmd` — proposed TO-BE (labelled proposed)
3. `03-multi-tenant-request-lifecycle.mmd`
4. `04-database-erd.mmd`
5. `05-authentication-authorization.mmd`
6. `06-background-jobs.mmd`
7. `07-deployment-infrastructure.mmd`
8. `08-critical-feature-data-flows.mmd`
9. `09-free-tier-resource-architecture.mmd`
10. `10-cloudflare-r2-upload-download.mmd`

## 9. Cost estimation

- Existing: Vercel Hobby, Supabase Free, Upstash free tier → IDR 0 additional.
- Proposed additions (Cloudflare R2/DNS/CDN, GitHub Actions, UptimeRobot) → IDR 0 additional within free quotas; R2 overage would be the first paid trigger (documented in `RESOURCE_UPGRADE_TRIGGERS.md`).

## 10. Priority recommendations (P0/P1)

- P0: parallelize sequential dashboard/action-center fetches; add pagination where unbounded lists exist; keep RLS authority in one membership-resolution function per request; tenant-skip background jobs.
- P1: move exports/OCR to tracked background jobs; adopt R2 for bytes; add Web Vitals + API latency instrumentation; introduce `next build` bundle budgets.
- Detail in `07-implementation-roadmap/PRIORITY_MATRIX.md` and `ACCEPTANCE_CRITERIA.md`.

## 11. Implementation roadmap

Phase 0 (baseline) → Phase 8 (resource optimization) in `07-implementation-roadmap/IMPLEMENTATION_ROADMAP.md`. No phase is mandatory immediately.

## 12. Links to detailed documents

- Discovery: `01-discovery/REPOSITORY_INVENTORY.md`, `CURRENT_ARCHITECTURE.md`, `TECHNICAL_STACK.md`
- Performance: `02-performance/*`
- Multi-tenancy: `03-multi-tenancy/*`
- System architecture: `04-system-architecture/*`
- Resources + cost: `05-resource-planning/*`
- Observability/testing: `06-observability-and-testing/*`
- Roadmap: `07-implementation-roadmap/*`
- Decisions: `08-architecture-decisions/*`
