# Caching & Data Flow

- Existing: Supabase Postgres reads on request; Upstash Redis installed (rate limiting verified; read-through cache usage unverified end-to-end — do not assume hit rates).
- Proposed caching policy (Phase 2): cache class metadata + dashboard stats per university+class, 30–60s TTL, invalidate on write; tenant-keyed keys; caches are a performance layer, never an authorization layer.
- Request dedupe: React `cache()` for repeated role/class resolution within one request.
- CDN: Cloudflare in front (proposed) for static assets; API responses stay `no-store` except public class discovery.

Related: diagrams/03-multi-tenant-request-lifecycle.mmd · README.md
