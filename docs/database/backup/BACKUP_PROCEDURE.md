# Backup Procedure — StarsTask

## Required tools

- Supabase Dashboard (managed backups / PITR)
- `pg_dump` / `pg_restore` matching PostgreSQL major (17)
- Read-only DB access via Supabase MCP or SQL Editor

## Secure credential handling

- Never print connection string or service-role key.
- Pass password via `PGPASSWORD` env-only or interactive prompt, never in argv/history.
- Store dumps outside repo, exclude from Git (`*.dump`, `backups/`).

## Full logical dump (preferred)

```powershell
pg_dump -h "$env:SUPABASE_DB_HOST" -p 5432 -U postgres -d postgres `
  -Fc -Z 9 -f "<outside-repo>\startask-YYYYMMDD-HHmmss.dump"
```

Schema-only companion:

```powershell
pg_dump -h "$env:SUPABASE_DB_HOST" -p 5432 -U postgres -d postgres `
  -Fc -s -f "<outside-repo>\startask-YYYYMMDD-HHmmss.schema.dump"
```

## Supabase managed backup

Dashboard → Database → Backups. Record PITR enabled, retention, last backup. Do not change plan/settings in Phase 1.

## Storage backup (separate)

Buckets are in `storage.buckets`; file bytes are NOT in `pg_dump`. Inventory + export bucket files via Supabase Console / CLI per bucket, or document as gap.

## Recovery

See `RESTORE_RUNBOOK.md`.

## Status

- Procedure documented: VERIFIED
- Logical dump executed: BLOCKED (no pg_dump in this environment)
- Test restore: INCOMPLETE
