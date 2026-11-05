# Phase 4B Recovery Gate — StarsTask

> **Date:** 2026-11-04 (Phase 4B).
> **Scope:** read-only review of existing backup documentation and Phase 3 results.
> No backup was created or overwritten. No production access beyond Phase 4A was used.
> **Evidence legend:** VERIFIED = directly observed in catalog/docs; INFERRED = interpretation;
> UNKNOWN = insufficient evidence; BLOCKED = owner action required.

---

## 1. What exists today (VERIFIED from docs/database/backup/*)

| Document                                     | Content                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKUP_INVENTORY.md`                        | Inventory: 52 public tables, `auth` 27, `storage` 10, `vault` 1, `realtime` 3, `backup_20261104` 52 (data-only). DB size ~19.0 MB. Auth users 32.                                                                                                                                                                                                                                |
| `BACKUP_VERIFICATION.md`                     | Snapshot schema `backup_20261104` (52 tables, ~768 kB, CREATE TABLE AS). Full logical dump: none. SHA-256: N/A (no file). `pg_restore --list`: N/A. Isolated restore: NOT performed. `pg_dump`/`pg_restore` NOT FOUND on the audit machine (PostgreSQL 18 dir has no `bin/`). Owner-operated command block provided. Final status: **INCOMPLETE — do not treat as recoverable.** |
| `BACKUP_PROCEDURE.md` + `RESTORE_RUNBOOK.md` | Procedure + isolated-restore steps, RLS/policy verification queries, app smoke steps. Fallback snapshot-restore explicitly marked **not a full restore** (no index/trigger/function/RLS rebuild).                                                                                                                                                                                |
| `SECURITY_RECOVERY_SIGNOFF.md`               | Sign-off gate reference.                                                                                                                                                                                                                                                                                                                                                         |

Snapshot counts at snapshot time (RESTORE_RUNBOOK §7): `profiles 32`, `classes 1`,
`class_members 30`, `discussion_sessions 14`, check-ins 129,
`attendance_correction_audits` 106. KC117 meeting 13 recap expected 27 present.

## 2. Gate checklist (VERIFIED vs INCOMPLETE)

| #   | Recovery requirement                           | Status                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1 | Full logical PostgreSQL backup (`pg_dump -Fc`) | **INCOMPLETE / BLOCKED** | No dump file exists. `pg_dump` absent on audit machine. Data-only snapshot is **not** a recovery point (no schema objects).                                                                                                                                                                                                                                                                                                     |
| G-2 | SHA-256 checksum recorded                      | **NOT APPLICABLE**       | No file to hash (`Get-FileHash` not run; do not invent).                                                                                                                                                                                                                                                                                                                                                                        |
| G-3 | `pg_restore --list` validation                 | **NOT APPLICABLE**       | No dump file.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| G-4 | Isolated restore test                          | **INCOMPLETE**           | Not performed. Requires fresh DB (`createdb starstask_restore_test_YYYYMMDD` or new Supabase project) + owner approval.                                                                                                                                                                                                                                                                                                         |
| G-5 | Auth-related recovery coverage                 | **INCOMPLETE**           | `auth.users` NOT exportable via `pg_dump public`. `profiles.id → auth.users(id)` FK fails if users missing. Needs Supabase Auth Admin export or PITR/UI.                                                                                                                                                                                                                                                                        |
| G-6 | Storage object recovery                        | **INCOMPLETE**           | File bytes NOT in any dump. Bucket counts inventoried only (attachments 2, avatars 3, leave-evidence 6, class-media 0, verification-evidence 0). Needs per-bucket export + re-upload + metadata comparison.                                                                                                                                                                                                                     |
| G-7 | Extensions + scheduled jobs recovery           | **PARTIAL**              | Extensions version-inventoried (5: `pg_stat_statements` 1.11, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1, `uuid-ossp` 1.1 — Phase 4A). `pg_cron` NOT installed anywhere — "scheduled jobs recovery" is **NOT APPLICABLE** to the DB; retention jobs run via Next.js API cron routes whose Vercel schedule is UNKNOWN. Extensions recover via `CREATE EXTENSION IF NOT EXISTS` in a restore script (not yet written). |
| G-8 | PITR status (Supabase)                         | **UNKNOWN**              | Dashboard → Database → Backups not recorded in docs. Must be read by owner; do not change plan.                                                                                                                                                                                                                                                                                                                                 |
| G-9 | RLS/policy/function/trigger rebuild            | **INCOMPLETE**           | Snapshot fallback explicitly cannot rebuild these. Full dump requires them.                                                                                                                                                                                                                                                                                                                                                     |

**Overall gate verdict: INCOMPLETE — NO-GO for structural refactoring** (any tenant or rename
migration needs a verified recovery point first).

## 3. Exact owner-operated procedure to close the gate

Run from a machine with PostgreSQL 17 client tools and project network access.
Never commit `.dump`, `.env*`, or password files. Rotate the DB password after backup.

```powershell
# 1. Secure credential (never in argv/history, never printed)
$env:PGPASSWORD = Read-Host -AsSecureString  # project owner pastes DB password from Supabase Dashboard

# 2. Full dump (outside repo, outside OneDrive if possible)
pg_dump -h "<supabase-db-host>" -p 5432 -U postgres -d postgres -Fc -Z 9 -f "C:\backups\starask\starask-YYYYMMDD-HHmmss.dump"

# 3. Schema-only companion
pg_dump -h "<supabase-db-host>" -p 5432 -U postgres -d postgres -Fc -s -f "C:\backups\starask\starask-YYYYMMDD-HHmmss.schema.dump"

# 4. Integrity
Get-FileHash C:\backups\starask\starask-*.dump -Algorithm SHA256
pg_restore --list C:\backups\starask\starask-*.dump | Measure-Object

# 5. Record client versions
pg_dump --version; pg_restore --version
```

Then:

1. Restore into isolated target per `RESTORE_RUNBOOK.md` (`createdb starstask_restore_test_*`
   or new Supabase project). Record target ref/name/timestamp in the backup manifest.
2. Run RLS verification queries (expect 52 `relrowsecurity=true`, 83 public policies).
3. Point a preview deployment at the isolated target; run `pnpm typecheck`, `pnpm test`, smoke
   queries (row counts + KC117 meeting 13 recap = 27 present).
4. Record closure: G-1…G-9 each → VERIFIED with file hash + manifest path. Update
   `BACKUP_VERIFICATION.md` status table.
5. Auth (G-5) and storage bytes (G-6) are separate owner flows:
   - Auth: Supabase Auth Admin export / PITR for `auth` schema, then re-link `profiles.id`.
   - Storage: export each bucket → re-upload → compare `storage.objects` per `bucket_id` counts.

## 4. Risks if the gate stays open

- Any migration without a verified restore point is unrecoverable-by-design (especially
  AD-07/AD-08 tenant columns + unique swaps).
- The data-only snapshot `backup_20261104` gives a false sense of safety: it cannot rebuild
  indexes, triggers, functions, RLS, sequences, or grants.
- `rls_auto_enable` drift means a local restore test may behave differently from production
  (production auto-enables RLS on new tables). Test restores must run after the U-1 decision.

## 5. Decision

**Recovery gate: INCOMPLETE (G-1, G-4, G-5, G-6 blocked; G-2/G-3 N/A; G-7 partial; G-8 unknown).**
Structural refactoring migrations are **NO-GO** until the owner closes G-1 + G-4 at minimum
(full dump + isolated restore + hash recorded). Auth/storage closure (G-5/G-6) is required
before any migration touching `auth.users` FKs or bucket policies.
