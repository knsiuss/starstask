# Backup Verification — StarsTask (Phase 3 update)

## Environment gate

- Project: `starstask` (`kdqsrckmmoucdqiapovr`), DB `postgres`, user `postgres`.
- Server: `PostgreSQL 17.11` (aarch64, gcc 15.2.0) — confirmed via `SELECT version()`.
- Client tools checked 2026-11-04 on this machine:
  - `pg_dump` — **NOT FOUND** (`where.exe pg_dump` no match; `C:\Program Files\PostgreSQL\18` contains only `data/`, no `bin/`).
  - `pg_restore` — NOT FOUND in PATH.
  - Consequence: pg_dump version **UNKNOWN** (cannot record), no dump file could be produced from here.

## Local procedure verification (2026-11-05, disposable DB)

- `pg_dump`/`pg_restore` version **17.11** inside
  `supabase_db_starstask` (Docker, local Supabase — NOT production).
- Full dump: `/tmp/starask-local-20261105.dump` (1,570,964 bytes),
  SHA-256 `29c49e98bd9b851a4db2caea4a5b056a75db3544554c25fb86550c0dc7a84ff1`.
- Schema-only dump: `/tmp/starask-local-20261105.schema.dump`
  (1,380,341 bytes), SHA-256
  `3339210d4b1c1f0400aaf70529e39e95837176fb8197ba0ba5d57a74b1a0cd56`.
- `pg_restore --list` counts: full 2499 entries, schema-only 2359.
- Isolated restore target: `starask_restore_test_20261105`.
  Result: `public` tables 77/77, `supabase_migrations` rows 82/82,
  `class-media` objects 3/3. `pg_restore` reported 167 non-fatal
  errors (Supabase storage/hooks noise on a fresh DB) but schema +
  data matched. Copies at `D:\backups\starask\local\` (outside repo).
- **This verifies the local dump/restore procedure only.** It does NOT
  verify the production project `kdqsrckmmoucdqiapovr` — no production
  password was used, no production dump was produced.

## Backup file information

- Snapshot schema `backup_20261104`: 52 data-only tables, ~768 kB (Phase 1).
- Full logical `.dump` (production): **none exists**.
- Schema-only dump (production): none.
- Timestamp of snapshot: 2026-11-04.

## SHA-256 / pg_restore --list

- NOT APPLICABLE — no dump file. `Get-FileHash` not run (nothing to hash). Do not invent a checksum.

## Owner-operated instructions (BLOCKED task handoff)

Run from a machine with PostgreSQL 17 client (`pg_dump`/`pg_restore`) and network access to the project:

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
# 5. Record client version
pg_dump --version; pg_restore --version
```

Store hostname/key **names only** in docs; never commit `.dump`, `.env*`, or password file. Rotate password after backup.

## Restore test

- Local isolated restore: **VERIFIED** (2026-11-05, see above;
  `starask_restore_test_20261105`).
- Production restore test: **INCOMPLETE** (not performed; requires
  the production dump below + a fresh DB / new Supabase project.
  Owner approval required).

## Per-bucket / Auth backup

- Auth (`auth.users` 32 rows, OAuth provider config): not exportable via `pg_dump public` — separate Supabase Auth Admin flow needed. **INCOMPLETE**.
- Storage bytes: `assignment-attachments` 2 objects, `avatars` 3, `leave-evidence` 6, `class-media` 0, `verification-evidence` 0 (from `storage.objects` counts). File bytes NOT in any dump. **INCOMPLETE**.

## Final backup status

| Item                                         | Status                                       |
| -------------------------------------------- | -------------------------------------------- |
| Snapshot `backup_20261104` (data-only)       | INCOMPLETE (not a recovery point)            |
| Local disposable dump + restore (2026-11-05) | **VERIFIED** (procedure only)                |
| Full logical dump (production)               | **BLOCKED** (owner step above)               |
| SHA-256 / `pg_restore --list` (production)   | NOT APPLICABLE                               |
| Production restore test                      | INCOMPLETE                                   |
| Overall production recovery point            | **INCOMPLETE** — do not treat as recoverable |
