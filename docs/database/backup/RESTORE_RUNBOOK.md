# Restore Runbook — StarsTask (Phase 3: owner steps)

All restores require explicit owner approval. Never restore over production. Destructive steps allowed only on the isolated target DB.

## 1. Prepare isolated target

```powershell
createdb starstask_restore_test_20261104
# or: Supabase Dashboard → new isolated project (preferred if no local PG17)
```

Record target ref/name/timestamp in the backup manifest.

## 2. Restore PostgreSQL data (after owner runs BACKUP_VERIFICATION dump)

```powershell
pg_restore -d starstask_restore_test_20261104 --no-owner --no-privileges C:\backups\starask\starask-*.dump
```

Schema-only dump first if restoring schema separately; then data.

Fallback (snapshot `backup_20261104` only): create tables from schema dump, then copy table-by-table. This is **not** a full restore (no index/trigger/function/RLS rebuild).

## 3. Auth dependencies

`auth.users`, identities, MFA, OAuth providers are NOT restored by a `public` dump. Re-provision via Supabase Auth Admin API, or restore via PITR/UI. `profiles.id → auth.users(id)` FK will fail if users are missing.

## 4. Storage objects

`pg_dump` does NOT include bytes. Export each bucket (Console/CLI), re-upload, compare metadata counts (`storage.objects` per `bucket_id`: attachments 2, avatars 3, leave-evidence 6, class-media 0).

## 5. RLS verification

- `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1;` — expect all `true`.
- `SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY 1,2;` — expect 83 rows.
- Check `courses_public_read` / `profiles_public_read` still `true` (public catalogue intentional).

## 6. Application connectivity

Point a preview deployment at the isolated target (`SUPABASE_URL`/`DATABASE_URL` non-secret refs only). Run `pnpm typecheck`, `pnpm test`, smoke queries. Confirm no server secrets in client bundle.

## 7. Post-restore validation

- Row counts match inventory (`profiles 32`, `classes 1`, `class_members 30`, `discussion_sessions 14`, check-ins 129, `attendance_correction_audits` 106 at snapshot time).
- KC117 meeting 13 (`a9d84791-…`) recap returns 27 present.
- `audit_logs` / `attendance_correction_audits` present.

## Manual / authorization

- Full dump + restore need owner run (BLOCKED task in Phase 3 — see BACKUP_VERIFICATION.md).
- PITR status check: Dashboard → Database → Backups (record enabled/retention/last backup; do not change plan).
