# Backup Inventory — StarsTask

## Database environment

- Project: `starstask` (ref `kdqsrckmmoucdqiapovr`)
- Current DB: `postgres`, user `postgres`
- Server: `PostgreSQL 17.11`
- DB size: ~19.0 MB (`pg_database_size`)
- `public` tables: 52, size ~3.4 MB
- Schemas: `public`, `auth` (27 tables), `storage` (10), `vault` (1), `realtime` (3), `supabase_migrations` (1), `backup_20261104` (52, created 2026-11-04)
- Auth users: 32

## Schema inventory (public)

52 tables, including `profiles`, `classes`, `class_members`, `class_admins`, `class_subjects`, `discussion_sessions`, `discussion_session_checkins`, `attendance_correction_audits`, `assignments`, `leave_requests`, `course_materials`, `notification_*`, telemetry, etc.

Views/matviews: none inventoried in public (catalog check); functions/triggers/RLS/extensions: record with Phase 2 audit.

## Backup coverage

| Component                       | Logical snapshot (`backup_20261104`) | Limitation                                                                |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `public` data (52 tables)       | Covered (CREATE TABLE AS)            | No schema objects, sequences, indexes, triggers, functions, RLS           |
| Schema-only (DDL, indexes, RLS) | Not covered                          | Requires `pg_dump -s` — not performed                                     |
| `auth` schema                   | Not covered                          | Supabase managed, no safe export this phase                               |
| Storage objects                 | Not covered                          | Only bucket/object counts inventoried; file bytes need separate procedure |
| Extensions, cron jobs           | Not covered                          | Extension versions not recorded yet                                       |

## Backup limitations

- Snapshot is data-only, not a full logical dump.
- No PITR status verified from dashboard.
- No test restore performed (Phase 1 only, no write to isolated DB).
- No `pg_dump` file exists; checksum does not apply.

## Status

- Inventory: VERIFIED (catalog queries above)
- Logical dump: BLOCKED (no direct pg_dump access via MCP)
- Test restore: INCOMPLETE (not performed; Phase 1 phase 1 scope)
