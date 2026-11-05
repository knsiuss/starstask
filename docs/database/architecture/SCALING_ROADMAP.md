# Scaling Roadmap (prioritized, nothing implemented)

Template per item: current / evidence / problem / proposed / benefit / complexity / risk / rollback / tests.

## P0

### 1. Full logical backup + isolated restore (closes Phase 1)
- Current: snapshot `backup_20261104` is data-only (52 tables), no `.dump`, no SHA-256, no test restore.
- Evidence: `docs/database/backup/BACKUP_VERIFICATION.md` marked INCOMPLETE.
- Problem: no verified recovery point.
- Proposed: `pg_dump -Fc` from authorized machine → SHA-256 → `pg_restore --list` → restore to fresh isolated DB → count checks (`profiles 32`, `classes 1`, check-ins 129).
- Benefit: recoverability. Complexity: LOW (ops). Risk: credential handling. Rollback: N/A (read-only). Tests: checksum match, row counts, RLS spot check.

### 2. Multi-tenant design gate (no DDL until P0.1 + P0.3 done)
- Current: no tenant columns; single class.
- Evidence: `information_schema` empty for tenant columns.
- Proposed: `universities`, `university_memberships`, `university_id` + tenant-scoped uniques + 83 policies rewritten + 143 functions audited.
- Complexity: HIGH. Risk: cross-tenant leak. Rollback: feature-flag off + keep single-tenant RLS. Tests: cross-tenant fuzz (user A cannot read tenant B), RLS policy dump diff.

### 3. Full `pg_policies` qual dump + SECURITY DEFINER review
- Current: 83 policies exist, text not line-reviewed; 143 SECURITY DEFINER fns.
- Proposed: dump `pg_policies` + `pg_get_functiondef` for all secdef, grep for missing `auth.uid()` scoping and `SET search_path`.
- Benefit: closes the "trusted pattern" gap. Complexity: LOW. Tests: dump file reviewed and signed off.

## P1

### 4. `is_class_member` hot-path cost
- Evidence: `class_members seq_scan 23903` on 30 rows.
- Proposed (in order): keep request-cache (`cebc170`); then `STABLE` + `(class_id,user_id)` composite; measure via `pg_stat_statements` before DDL.

### 5. Auth `ON DELETE CASCADE` wipes academic history
- Proposed: suspend instead of delete for members; FK action change after product decision.

### 6. `class-media` public bucket review (P1 confirm contents; if student photos → private + signed URLs)

### 7. `app_error_events` PII scrub + 90-day purge (verify no personal data)

## P2

### 8. Recap aggregation server-side; `LIST_COLUMNS_SLIM` for session lists; batch member loads.
### 9. Notification/push/calendar load test (0-row pipelines).
### 10. Index pruning/merging (`assignments`, `discussion_sessions`, `notification_events`) after EXPLAIN at 10× volume.
### 11. Storage orphan sweep + lifecycle policy (`leave-evidence`).

## P3

### 12. `audit_logs` partitioning (month) at >100k rows.
### 13. Read replica / materialized recap (only with measured >1s p95 at scale — none today).
### 14. Course/subject naming alignment doc (`classes` vs `courses` vs `class_subjects`) — docs-first, no rename until multi-tenant lands.

## Stop condition reminder

No item above is a directive. Each needs explicit approval + migration plan + rollback + tests before execution.
