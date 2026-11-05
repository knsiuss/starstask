# Architecture Decision Records

Summaries; full context per ADR available on request. **None are implemented yet** (except existing stack noted).

1. **DB tenancy:** shared DB + shared schema + `university_id` (recommended; alternatives rejected §MULTI_TENANT_ARCHITECTURE).
2. **Tenant context resolution:** server per-request middleware from `university_memberships`; signed session claim; never client param.
3. **Tenant-aware RLS:** `university_id = current_university_id()` + existing class predicates; single function per request.
4. **Redis caching:** selective cache (class metadata, dashboard stats), tenant-keyed, 30–60s TTL; cache is never authz.
5. **Cloudflare R2:** bytes in R2, metadata in Postgres, signed URLs; Supabase Storage remains only as fallback.
6. **Background processing:** DB-backed queue + Vercel cron scheduler; retry with backoff; idempotency keys.
7. **Exports:** move to background jobs (recap/report/checklist/leave OCR/schedule parse).
8. **Observability:** Web Vitals + API latency + Sentry/PostHog free + UptimeRobot; tenant-level metrics.
9. **Separate backend:** rejected (no evidence; IDR 0 goal) — single Next.js surface.
10. **Supabase suitability:** retained (Auth/RLS/Storage fit; free tier covers Phase 0–3).
11. **Realtime necessity:** not required; polling on-open only.
12. **University integrations:** leave as domain settings per university (`university_settings`), no hardcoding.
13. **Free-tier selection:** existing-first list in FREE_TIER_RESOURCE_INVENTORY.md.

Each ADR follows Context → Problem → Options → Advantages/Disadvantages → Recommendation → Consequences → Open questions (one-line summaries here; expandable).

Related: README.md · OPEN_QUESTIONS.md
