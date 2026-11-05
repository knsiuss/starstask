# Database Audit Summary — StarsTask

Phase 1 + read-only Phase 2 audit complete. **No production schema, RLS, function, or data change was made.**

## Final report (required statuses)

1. Production identified? — **VERIFIED**: project `starstask` (`kdqsrckmmoucdqiapovr`), Postgres 17.11, DB ~19 MB, 52 public tables, auth users 32, single class `05TPLM002`.
2. Backup created? — **INCOMPLETE**: snapshot `backup_20261104` (52 data-only tables, 768 kB) exists; **no full logical `.dump`**.
3. Backup integrity verified? — **INCOMPLETE**: no SHA-256 / `pg_restore --list` (need `pg_dump` access from authorized machine).
4. Test restore completed? — **INCOMPLETE**: not performed (isolated DB pending).
5. Components needing separate backup? — **Auth** (`auth.users`/OAuth config, 32 users), **Storage file bytes** (5 buckets, counts per bucket UNKNOWN), extensions/jobs. `pg_dump` alone covers `public` only.
6. Biggest schema issues? — P0 no tenant boundary; P1 `class_members` seq-scan storm (23,903 scans / 30 rows); P1 `classes`/`courses`/`class_subjects` naming overlap; P1 `ON DELETE CASCADE` from `auth.users` wipes history.
7. Highest-priority scaling improvements? — P0 full backup+restore, P0 multi-tenant gate, P0 policies/secdef dump; then P1 hot-path + bucket + error-event items (see SCALING_ROADMAP).
8. Risks before migrations? — No verified recovery point; 83 policies + 143 SECURITY DEFINER functions not line-reviewed; `class-media` public bucket unconfirmed; `pg_stat_statements` not captured.

## Key evidence

- Tables: 52 listed in `pg_tables` + `backup_20261104` snapshot.
- Indexes: full public index list captured; measured seq/idx scans in INDEX_AUDIT.md.
- RLS: all 52 tables `relrowsecurity=true`; 83 policies; 159 functions (143 SECURITY DEFINER).
- Tenant: zero `university_id`/`tenant_id` columns (catalog query empty).
- Perf: prior DevTools 2.41s/1.38s baseline, already improved by `cebc170` (prefetch off, single board mount, cached `listMyClasses`, `countLeaveRequestsByStatus` 4→1, slim columns).

## Missing evidence / blocked

| Item | Status |
|---|---|
| Full `pg_policies.qual` text review | NOT VERIFIED (dump pending) |
| `pg_get_functiondef` + `search_path` full sweep | NOT VERIFIED (spot check clean) |
| Storage object counts per bucket | UNKNOWN |
| `pg_stat_statements` top queries / EXPLAIN at scale | NOT COLLECTED (correctly avoided on prod) |
| Check-constraint full count | NOT VERIFIED (query truncated) |
| pg_cron / purge jobs running | UNKNOWN |
| PITR status from dashboard | UNKNOWN |

## Diagrams

See `architecture/CURRENT_DATABASE_ARCHITECTURE.md` (ER + flow) and `architecture/PROPOSED_DATABASE_ARCHITECTURE.md` (tenant isolation). All diagrams grounded in the 52-table catalog above.

## Recommended next steps

1. Run P0.1: `pg_dump` + checksum + isolated restore from authorized machine; flip BACKUP_VERIFICATION.md to VERIFIED only with evidence.
2. Dump `pg_policies` + secdef bodies to file; line-review; sign off before multi-tenant DDL.
3. Confirm `class-media` contents; decide public vs private.
4. Capture `pg_stat_statements` on staging at 10× volume; then revisit index list.
5. Only then approve multi-tenant migration plan (P0.2).

**STOP.** Audit + proposal only. No migrations applied. Backup remains INCOMPLETE until steps 1–2 evidence is recorded.
