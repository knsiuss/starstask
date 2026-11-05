# Data Migration Strategy (Phase 6 — plan only, no migrations executed)

1. Create `universities` + `university_memberships` with single seeded university (existing production tenants).
2. Add nullable `university_id` columns to all tenant-scoped tables (§TENANT_DATA_MODEL).
3. Backfill with single university id; verify counts vs. `database.generated.ts` row expectations.
4. Create composite indexes leading with `university_id`.
5. Add composite FKs `(university_id, id)` with `NOT VALID` then `VALIDATE`.
6. Backfill RLS with tenant predicates; verify existing (single-tenant) behavior unchanged via the drift check in `database-contract.ts`.
7. Set `NOT NULL` + tenant-scoped unique constraints, per-release, with row-count assertions.
8. Rollback: drop columns/constraints in reverse; backfill is idempotent via `university_id IS NULL` guard.

Related: README.md · TENANT_DATA_MODEL.md
