# Multi-Tenant Audit

Evidence: `information_schema.columns` query for `university_id`/`tenant_id`/`org_id` returned **empty**. `classes` 1 row. `profiles` 32 rows, no tenant link.

## Current tenant model

There is none. Implicit single-tenant: one `classes` row (`05TPLM002`), one cohort of 30 members. Authorization dimension is **class**, not university.

- User→tenant: NOT EXISTS.
- Class→tenant: NOT EXISTS (`classes` has `course_id`, `period`, `semester` — no university FK).
- `courses` catalogue is global.
- `platform_admins` empty (0 rows) — global admin role exists in schema, unused.

## Why `university_id` alone is insufficient (P0 for multi-university plan)

Adding a column without these four pieces leaves cross-tenant reads open:

1. Tenant-scoped unique constraints (e.g. `classes_period_code_key` is global today — two universities with same class code collide).
2. RLS predicates must include tenant check in every policy (83 policies to rewrite, all `is_class_member`-based).
3. SECURITY DEFINER functions that bypass RLS must re-check tenant (143 functions to audit — `can_manage_class`, `join_class_by_name`, etc.).
4. Server-side tenant context resolution (middleware/JWT claim) — never trust client-supplied `university_id`.

## Proposed model (design, not implemented)

- `universities` (tenant root), `university_memberships` (user↔university), `university_settings`.
- Shared schema, shared tables. Every multi-tenant table gets `university_id NOT NULL`.
- Unique constraints become `(university_id, …)`.
- RLS: `university_id = current_tenant()` AND class-membership check (AND, not replace).
- Server resolves tenant from verified session + membership; client never sets it.
- `courses` stays global-catalogue but approval-scoped per university; `classes` tenant-owned.

Complexity: HIGH. 83 policies + 143 SECURITY DEFINER functions + migration + backfill. Go/no-go gate: Phase 1 full logical backup VERIFIED + isolated restore + per-policy dump reviewed.

## Readiness verdict

**NOT READY.** Current model is single-tenant with class-level isolation, which is correct for one class. Multi-university is a P0 project, gated on backup + RLS dump. Do not start until `DATABASE_AUDIT_SUMMARY.md` P0 items close.
