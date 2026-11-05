# Database & RLS Audit

## Schema inventory (method: read `database.generated.ts` summaries + migration names)

Tenant-relevant table groups (verified names include): `users`/`profiles` (to verify), `classes`, `class_members`, `class_course_schedules`, `subjects`/`class_subjects`, `assignments`, `assignment_submissions`, `leave_requests`, `leave_request_history`, `leave_lecturer_outcomes`, `leave_request_forwardings`, `discussion_sessions`, `discussion_session_checkins`, `attendance_verification_attempts`, `notifications`, `push_subscriptions`, `audit_logs` (pattern), `api_rate_limits` (pattern).

## Findings

- RLS policies exist across tables (78 migrations); `SECURITY DEFINER`-style RPCs (`review_class_assignment`, `review_leave_request`, `can_manage_class`, `record_audit`, `attendance_*`) carry authz for mutations.
- Index gaps to verify in authorized env: `(class_id, user_id)` on join tables; `(class_id, status, due_at)` on assignments; `(session_id, user_id)` uniqueness already modelled; `(request_id, actor_id)` on leave history.
- **Hypotheses (require EXPLAIN ANALYZE / `pg_stat_statements` before acting):** per-row membership EXISTS overhead (§5.4), count queries on dashboard aggregates, missing composite index on `(subject_id, starts_at)` for attendance sessions.
- **Do not disable RLS** for performance — optimize membership resolution (single `get_my_class_ids()` cached per request) and lean `SECURITY DEFINER` RPCs.

## Recommended one-time verification (hypotheses to confirm)

1. `EXPLAIN ANALYZE` on dashboard aggregates, `getClassAttendance`, leave history timeline, notification list.
2. `pg_stat_statements` top-20 duration/volume after 7 days.
3. Duplicate-index scan via `pg_indexes` grouping.

Related: README.md · TENANT_DATA_MODEL.md
