# Query Performance Audit (code + pg_stat evidence, no invented timings)

Evidence: `pg_stat_user_tables` scans; prior live DevTools: `/schedule ~2.41s`, `/leave-requests ~1.38s` (pre-`cebc170`); code `lib/db/*.ts`, `attendance/recap.ts`, `attendance-sheet.tsx`.

## Feature findings

### Dashboard / Action Center

- `leave.ts` `countLeaveRequestsByStatus` previously 4 queries → now 1 (`cebc170`). `listMyClasses` cached per request. Measurable win already shipped; do not re-introduce status-by-status counting.
- `action_center_idx` on `leave_requests` exists. Action Center still fans out to multiple lightweight counts — P2 consolidate into single `GROUP BY status` RPC (rollback: keep per-status fallback).

### Attendance (hottest path)

- Recap: `buildAttendanceRecap` marks unopened meetings `not_applicable`. UI totals ignore them. Root cause of "0% sheet" was `attendance_opened_at IS NULL`, now fixed for 5/8/10/11 by direct DB open — operational fix, not schema.
- `discussion_session_checkins` 129 rows, `seq_tup_read 105137` — recap loads all check-ins per class page. P2: paginate/aggregate server-side (`COUNT GROUP BY session`) instead of client recap at scale.
- `prefetch={false}` on calendar links (`cebc170`) prevents prefetch storms. Keep.

### Exports (XLSX/PDF)

- Exports run via client builders over fetched data. No server-side aggregation observed. P2: move to RPC with tenant+class RLS check (exports must obey same RLS as page, per AGENTS §7.1 — currently not verifiable from code alone, mark NEEDS REVIEW).

### Notifications

- `notification_events` 7, deliveries 0. `claim_notification_*` RPC queue pattern is sound. Unproven under load (0 deliveries). P2: load test before enabling push for real class.

### N+1 / payload notes

- `loadProfiles` batch exists (single query). Keep pattern; do not fetch profiles per member.
- `LIST_COLUMNS_SLIM` pattern (drop `ocr_result`, `field_sources`, `search_vector`) is the template for all list endpoints. Apply to `discussion_sessions` list next (P2) — verify columns first.

## What is NOT proven

- No `pg_stat_statements` top-query list captured. No `EXPLAIN ANALYZE` on prod hot paths (correctly avoided). All index recommendations stay theoretical until measured on staging at ≥10× current volume.
