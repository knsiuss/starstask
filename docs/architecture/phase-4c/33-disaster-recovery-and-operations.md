# 33 — Disaster Recovery & Operations

> **Status:** DRAFT. **Backup evidence:** `docs/database/backup/` docs exist (`BACKUP_INVENTORY.md`, `BACKUP_PROCEDURE.md`, `BACKUP_VERIFICATION.md`, `PHASE_4B_RECOVERY_GATE.md`, `RESTORE_RUNBOOK.md` — existence VERIFIED; contents not re-verified with live infra). **Live backup status: UNKNOWN.**

## 33.1 Backup & recovery (evidence-based)

- **Known:** Supabase-managed backups (platform default) + repo restore runbook (REPORTED). No self-managed dump evidence in repo.
- **UNKNOWN:** PITR window, tested restore time, cross-region, staging parity guarantees. Phase 5A must close these (run a timed staging restore).

## 33.2 Retention per data class (RECOMMENDED)

| Class | Retention (RECOMMENDED) | Mechanism |
|-------|-------------------------|-----------|
| `attendance_verification_attempts` (geo attempts) | 90 days then anonymize | API cron `attendance-retention` (VERIFIED route) |
| `notification_deliveries` completed | 180 days | API cron `notification-retention` (VERIFIED) |
| `audit_logs` | 3 years hot, then cold archive | exports + purge RPC |
| Evidence/source files | while cited, + 1 year | storage lifecycle |
| Monitoring `*_events` | 12 months | app cron |

## 33.3 Monitoring

`app_error_events`, `auth_activity_events`, `app_activity_events` exist (VERIFIED) + admin dashboards. RECOMMENDED: tenant-scoped error-rate alerts, worker-lag (notification claim delay), cron heartbeat.

## 33.4 Incident handling

`developer_incidents` + notes tables (VERIFIED) are the tracker. RECOMMENDED: suspend tenant (Domain B lifecycle) without data loss; replays from outbox (`notification_events`) after incident.
