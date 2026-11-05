# Background Processing

## Existing (verified)

- `vercel.json`: `0 3 * * *` attendance-retention, `0 4 * * *` notification-retention.
- Route-level cron files (mechanism unverified — open question): `deadline-reminders`, `notification-events`, `session-jobs`.

## Proposed (Phase 4)

- DB-backed job queue table (`id`, `kind`, `payload`, `status`, `attempts`, `next_run`, `tenant_id`) consumed by cron every minute.
- Jobs: exports (recap/report/checklist), leave OCR, schedule PDF parse, attendance recompute.
- Guarantees: idempotency keys per kind; exponential backoff; status query endpoint `GET /api/jobs/[id]`; failure → admin-visible `audit_logs` entry; tenant membership re-verified before execute.

Related: README.md · diagrams/06-background-jobs.mmd
