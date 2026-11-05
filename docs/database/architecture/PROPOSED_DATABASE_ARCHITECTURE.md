# Proposed Database Architecture (design only, not implemented)

```mermaid
erDiagram
  universities ||--o{ university_memberships : member
  profiles ||--o{ university_memberships : user
  universities ||--o{ classes : tenant
  classes ||--o{ class_members : member
  classes ||--o{ discussion_sessions : meeting
  discussion_sessions ||--o{ discussion_session_checkins : attendance
```

```mermaid
flowchart LR
  REQ[Request] -->|JWT| MW[Server: resolve tenant from session+membership]
  MW -->|tenant_id claim| RLS[RLS: tenant = current_tenant AND is_class_member]
  RLS --> DB[Shared schema Postgres]
```

## Tenant isolation contract

1. `universities` is the tenant root. `university_memberships` binds user↔tenant.
2. Every tenant-owned table carries `university_id NOT NULL`.
3. Unique constraints become `(university_id, …)`.
4. RLS adds `AND university_id = current_tenant()` — never replaces class check.
5. SECURITY DEFINER functions re-check tenant server-side; client-sent `university_id` ignored.
6. `platform_admins` stays global, gated by separate claim — never via tenant column.

## What does NOT change

- `courses` catalogue stays shared (read-only, write via `create_or_get_course`).
- Attendance/leave/assignment tables keep their class FKs; `university_id` is additive.
- Backup/restore flow unchanged (see `backup/RESTORE_RUNBOOK.md`).

Migration complexity: HIGH (83 policies + 143 functions + backfill). Gated on full logical backup VERIFIED.
