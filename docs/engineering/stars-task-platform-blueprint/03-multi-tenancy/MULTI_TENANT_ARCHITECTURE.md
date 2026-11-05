# Multi-Tenant Architecture

## Recommendation

**Shared database + shared schema with strict tenant ownership** (`university_id` on tenant-scoped tables) is recommended over schema-per-tenant and database-per-tenant.

| Strategy | Cost | Security | Maintenance | Verdict |
|---|---|---|---|---|
| Shared DB + shared schema | Low (single Supabase instance) | Good **iff** tenant-aware RLS + server context | Low | **Recommended** |
| Shared DB, schema-per-tenant | Medium-large (Nx schema ops) | Strong isolation | High | DO NOT USE (complexity > value at this scale) |
| Database-per-tenant | High (multiple Supabase projects) | Strongest isolation | High | DO NOT USE until compliance/scale forces |

## Rules (binding for Phase 5–6)

1. Auth identity is global (Supabase Auth); **active university context is server-resolved per request** from memberships, never from client params alone.
2. Every tenant-scoped table carries `university_id NOT NULL`; composite FKs `(university_id, id)` enforce tenant consistency.
3. RLS: `university_id = current_university_id()` resolved by one DB function per request.
4. Storage object keys are tenant-namespaced: `{universityId}/{classId}/{year}/{file}`.
5. Cache keys are tenant-namespaced; cross-tenant caches are disallowed.
6. Class Admin authority is per-class + per-university; no global role.
7. Users can belong to multiple universities via `university_memberships`; switching requires membership proof + redirect.

Full model in TENANT_DATA_MODEL.md; risks/tests in TENANT_ISOLATION_SECURITY.md.

Related: README.md · diagrams/03-multi-tenant-request-lifecycle.mmd
