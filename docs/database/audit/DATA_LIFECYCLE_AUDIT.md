# Data Lifecycle Audit

Evidence: row counts per table (`pg_stat_user_tables n_live_tup`), retention migrations `20261031190000_checkin_coordinate_retention.sql`, `20261031210000_notification_delivery_retention.sql`, buckets inventory.

## Current retention posture

| Data                           | Rows                     | Retention seen                                        | Risk                                                                                                                                       |
| ------------------------------ | ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `audit_logs`                   | 288                      | Unbounded (no purge mig)                              | Growth, but academic audit must be preserved. P2: partition by month at >100k.                                                             |
| `app_error_events`             | 228                      | Unbounded                                             | PII risk (AGENTS §7.1 forbids logging personal data). P1: scrub + 90-day purge, verify no PII in `error` column (UNKNOWN, needs sampling). |
| `attendance_correction_audits` | 106                      | Permanent (correct — academic record)                 | Must not prune.                                                                                                                            |
| `discussion_session_checkins`  | 129                      | Coordinates pruned via `checkin_coordinate_retention` | Good. Confirm job runs (NOT VERIFIED).                                                                                                     |
| `notification_deliveries`      | 0                        | `notification_delivery_retention` mig exists          | Code path never ran; purge job unproven.                                                                                                   |
| `leave_request_history`        | 18                       | Append-only                                           | Preserve (academic history).                                                                                                               |
| Storage objects                | UNKNOWN count per bucket | No lifecycle policy observed                          | P1: orphan sweep for `leave-evidence` (private, uploads outlive requests?) + signed-URL expiry.                                            |

## Storage lifecycle

- Buckets: `assignment-attachments` (private), `avatars` (public), `class-media` (public), `leave-evidence` (private), `verification-evidence` (private). Object counts per bucket NOT inventoried — follow-up required.
- No deletion policy on `leave-evidence` after request closed. P2: archive + delete after semester end, with owner approval (academic records preserved in DB, files archived cold).

## Rules

- Do not delete historical academic records as optimization (AGENTS posture + this brief §6.5).
- Soft-delete > hard-delete for `class_members`, `assignments`, `leave_requests` going forward.
- Any purge needs: retention window, owner sign-off, pre-purge backup, audit-log entry.
