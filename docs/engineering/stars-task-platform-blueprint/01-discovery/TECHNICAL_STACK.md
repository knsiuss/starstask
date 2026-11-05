# Technical Stack

Purpose: concrete technology versions and roles as installed.

| Layer | Technology | Version/source | Role |
|---|---|---|---|
| Framework | Next.js App Router | 16.4.3 (`apps/web/package.json`) | RSC + client islands, route handlers |
| UI | React | 19.3.1 | Components |
| Language | TypeScript | 5.9.3 | End-to-end types, `database-contract.ts` drift guard |
| Auth/data | Supabase (Postgres, Auth, RLS, Storage) | `@supabase/ssr` 0.12.7, `supabase-js` 2.118.0 | Session, queries, storage |
| Cache/rate limit | Upstash Redis + Ratelimit | 1.40.0 / 2.2.0 | API guards (typeonly use verified) |
| Docs | ExcelJS, PDF-Lib, JSZip, unpdf | 4.4.0/1.17.1/3.10.2/2.0.0 | XLSX/PDF/OCR pipelines |
| Push | web-push | 3.6.7 | VAPID subscriptions (`/api/push/**`) |
| Contract | Zod | 4.6.7 | Boundary validation (`packages/contracts`) |
| Test | Vitest, Playwright | 5.0.5 / 1.64.1 | Unit + e2e (axe-core) |
| Host | Vercel | `vercel.json` 2 crons | Hosting + cron |
| Package mgr | pnpm | 11.10.0 | Monorepo |

Related: README.md · CURRENT_ARCHITECTURE.md
